/**
 * **UserInfo** 类型包含了登录以及刷新 token 后返回的信息，包含了用户的基本信息。
 */
export type UserInfo = {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  tenant_id: string;
  role_name: string;
  license: string;
  loginId: string;
  /** 用户 ID
   * 如果想要使用学号，应当使用 `user_name`
   */
  user_id: string;
  /** 学号 */
  user_name: string;
  /** 姓名 */
  real_name: string;
  avatar: string;
  dept_id: string;
  client_id: string;
  /** 学号 */
  account: string;
  jti: string;
};

/** 
 * **refresh** 函数用于刷新 token，需要传入 refresh_token。
*/
export async function refresh(refresh_token: string): Promise<UserInfo> {
  const body: FormData = new FormData();
  body.append("grant_type", "refresh_token");
  body.append("refresh_token", refresh_token);
  const res = await fetch(
    "https://apiucloud.bupt.edu.cn/ykt-basics/oauth/token",
    {
      method: "POST",
      headers: {
        authorization: "Basic cG9ydGFsOnBvcnRhbF9zZWNyZXQ=",
      },
      body,
    }
  );
  const json: UserInfo = await res.json();
  return json;
}

type Session = {
  id: string;
  cookie: string;
  execution: string;
}

/**
 * **CaptchaError** 错误类，当登录时需要验证码时会抛出这个错误。
 * 
 * 可以通过 {@link captcha} 方法获取验证码的 URL，通过 {@link resolve}(captcha: string) 方法来传入验证码。例如
 * 
 * ```ts
 * try {
 *    return await login(bupt_id, bupt_pass);
 * } catch (e) {
 *   if (e instanceof CaptchaError) {
 *     return await e.resolve(await resolveCaptcha(e.captcha()));
 *   } else {
 *     throw e;
 *   }
 * }
 * 
 */
export class CaptchaError extends Error {
  session: Session;
  username: string;
  password: string;
  constructor(message: string, data: {
    id: string
    cookie: string
    execution: string;
    username: string;
    password: string;
  }) {
    super(message);
    this.name = "CaptchaError";
    this.session = data;
    this.username = data.username;
    this.password = data.password;
  }

  /**
   * @returns 验证码的 URL
   */
  captcha(): string {
    return `https://auth.bupt.edu.cn/authserver/captcha?captchaId=${this.session.id}&r=${Math.random().toString().slice(2,7)}`
  }

  /**
   * 传入验证码
   * 
   * @param captcha 验证码
   * @returns Promise<{@link UserInfo}>
   */
  async resolve(captcha: string): Promise<UserInfo> {
    return await login(this.username, this.password, {
        ...this.session,
        captcha
    });
  }
}

async function getCookieAndExecution(username: string, password: string) {
  const res = await fetch(
    "https://auth.bupt.edu.cn/authserver/login?service=https://ucloud.bupt.edu.cn"
  );
  const cookie = res.headers.get("set-cookie");
  if (!cookie || !cookie.length) {
    throw new Error(`登录失败(-1): 无法获取到 cookie`);
  }
  const html = await res.text();
  const executions = html.match(/<input name="execution" value="(.*?)"/);
  if (!executions || !executions.length) {
    throw new Error(`登录失败(-2): 无法获取到 execution`);
  }
  const execution = executions[1];
  const capthas = html.match(/config.captcha[^{]*{[^}]*id: '(.*?)'/);
  const capthas_id = capthas?.[1];
  if (capthas_id) {
    throw new CaptchaError(`登录失败(-3): 需要验证码`, {
      id: capthas_id,
      cookie,
      execution,
      username,
      password
    })
  }
  return { cookie, execution };
}


/**
 * **login** 函数用于登录，需要传入用户名和密码。
 * 
 * ```ts
 * await login("username", "password");
 * ```
 * 
 * 当登录时需要验证码时会抛出 {@link CaptchaError} 错误，传入验证码的方式详见 {@link CaptchaError}。
 * 
 * @param username 用户名
 * @param password 密码
 * @param session 验证码的 session
 * @returns Promise<{@link UserInfo}>
 */
export async function login(
  username: string,
  password: string,
  session?: Session & { captcha: string }
): Promise<UserInfo> {
  const { cookie, execution } = session ?? await getCookieAndExecution(username, password);
  const bodyp = `username=${encodeURIComponent(
    username
  )}&password=${encodeURIComponent(password)}`;
  let response = await fetch(
    "https://auth.bupt.edu.cn/authserver/login?service=https://ucloud.bupt.edu.cn",
    {
      method: "POST",
      headers: {
        authority: "auth.bupt.edu.cn",
        "content-type": "application/x-www-form-urlencoded",
        cookie: cookie,
        referer:
          "https://auth.bupt.edu.cn/authserver/login?service=https://ucloud.bupt.edu.cn",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36 Edg/118.0.2088.61",
      },
      body:
        bodyp + (session?.captcha ? `&captcha=${session.captcha}` : "") +
        "&submit=%E7%99%BB%E5%BD%95&type=username_password&execution=" +
        execution +
        "&_eventId=submit",
      redirect: "manual",
    }
  );
  if (response.status != 302) {
    const html = await response.text();
    const errors = new RegExp(
      /<div class="alert alert-danger" id="errorDiv">.*?<p>(.*?)<\/p>.*?<\/div>/gs
    ).exec(html);
    const error = errors?.[1];
    if (response.status === 401) {
      if (error) {
        throw new Error(
          error === "Invalid credentials."
            ? "登录失败(3): 用户名或者密码错误"
            : "登录失败(4): " + error
        );
      } else throw new Error("登录失败(2): 未知错误");
    }
    throw new Error(
      "登录失败(1): " +
        response.status +
        " " +
        response.statusText +
        (error ? `(${error})` : "")
    );
  }
  const location = response.headers.get("Location");
  if (!location) {
    throw new Error("登录失败(5): 无法获取到重定向目标");
  }
  const urlParams = new URLSearchParams(new URL(location).search);
  const ticket = urlParams.get("ticket");
  if (!ticket) {
    throw new Error("登录失败(6): 无法获取到ticket");
  }
  response = await fetch(
    "https://apiucloud.bupt.edu.cn/ykt-basics/oauth/token",
    {
      headers: {
        accept: "application/json, text/plain, */*",
        authorization: "Basic  cG9ydGFsOnBvcnRhbF9zZWNyZXQ=",
        "content-type": "application/x-www-form-urlencoded",
        "tenant-id": "000000",
        Referer: "https://ucloud.bupt.edu.cn/",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
      body: `ticket=${ticket}&grant_type=third`,
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new Error(`登录失败(7): ${response.status} ${response.statusText}`);
  }
  return await response.json();
}
