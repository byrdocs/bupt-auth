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
 * **CASUserInfo** 类型包含通过 CAS（统一认证）校验直接获取的用户信息。
 *
 * 相比 {@link UserInfo}，它不经过 ucloud 换取 token，因此不含 `access_token`
 * 等字段，也没有角色信息，只有 CAS 服务端愿意暴露的基础属性。
 */
export type CASUserInfo = {
  /** 学号 */
  user_name: string;
  /** 姓名 */
  real_name: string;
  /** 身份类型代码，例如本科生为 `L0103` */
  type: string;
  /** CAS 返回的全部原始属性（不同 service 暴露的字段可能不同） */
  attributes: Record<string, string>;
};

/**
 * **LoginError** 错误类，当登录失败时会抛出这个错误。
 */
export class LoginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoginError";
  }
}

/**
 * **OCRError** 错误类，当验证码识别失败时会抛出这个错误。
 */
export class OCRError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OCRError";
  }
}

export enum Role {
  Student = "学生",
  Teacher = "教师",
  Assistant = "助教",
}

export type RoleInfo = {
  id: string,
  roleId: string,
  roleAliase: string,
  roleName: Role,
  domainId: string,
  domainName: string,
  // more fields are ignored
}

/**
 * **LoginOptions** 登录选项配置
 */
export type LoginOptions = {
  /**
   * 指定登录使用的角色（适用于一个账号有多个身份的情况）
   * 如果不指定，将使用默认角色
   *
   * 仅在走 ucloud 获取信息时生效（即 `cas` 未开启时）。
   */
  role?: Role;

  /**
   * 是否改用 CAS（统一认证）直接获取用户信息，而不经过 ucloud 换取 token。
   *
   * - `false`（默认）：走 ucloud，返回完整的 {@link UserInfo} 及角色列表。
   * - `true`：仅用 CAS `serviceValidate` 校验并返回 {@link CASUserInfo}，
   *   速度更快，但只包含学号、姓名、身份类型等基础属性，且没有 token 和角色。
   */
  cas?: boolean;

  /**
   * 验证码处理函数，当需要验证码时会调用此函数
   * @param captchaUrl 验证码图片的 URL
   * @param cookie 当前会话的 cookie
   * @returns 识别出的验证码文本
   */
  onCaptcha?: (captchaUrl: string, cookie: string) => PromiseLike<string>;

  /**
   * OCR 自动识别验证码配置
   * 如果设置了此项，当遇到验证码时会自动使用 OCR 识别
   */
  ocr?: {
    /**
     * Byrdocs OCR token
     */
    token: string;
    /**
     * OCR 失败时的最大重试次数（默认为 3）
     */
    maxRetries?: number;
  };
}

/**
 * **refresh** 函数用于刷新 token，需要传入 refresh_token。
 * @param refresh_token refresh token
 * @param role 角色（可选），适用于一个账号有多个身份的情况
 */
export async function refresh(refresh_token: string, role?: Role): Promise<UserInfo> {
  const body: FormData = new FormData();
  body.append("grant_type", "refresh_token");
  body.append("refresh_token", refresh_token);
  if (role) {
    const roles = await getUserRoles(refresh_token);
    const roleInfo = roles.find(r => r.roleName === role);
    if (!roleInfo) {
      throw new LoginError(`用户不存在角色 ${role}`);
    }
    body.append("identity", roleInfo.id);
  }
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
  if (!res.ok) {
    throw new LoginError(`刷新 token 失败: ${res.status} ${res.statusText}`);
  }
  const json: UserInfo = await res.json();
  return json;
}

/**
 * **getUserRoles** 函数用于获取当前用户的角色
 * @param token access token/refresh token
 * @returns Promise<{@link RoleInfo[]}>
 */
export async function getUserRoles(token: string): Promise<RoleInfo[]> {
  const res = await fetch("https://apiucloud.bupt.edu.cn/ykt-basics/userroledomaindept/listByUserId", {
    headers: {
      authorization: "Basic cG9ydGFsOnBvcnRhbF9zZWNyZXQ=",
      "Blade-Auth": token,
    },
  });
  if (!res.ok) {
    throw new LoginError(`获取用户角色失败: ${res.status} ${res.statusText}`);
  }
  return (await res.json())["data"] as RoleInfo[];
}

const SERVICE = "https://ucloud.bupt.edu.cn";
const LOGIN_URL = `https://auth.bupt.edu.cn/authserver/login?service=${SERVICE}`;

/**
 * 解析 CAS `serviceValidate` 返回的 XML，提取用户属性。
 */
function parseCasResponse(xml: string): CASUserInfo {
  const failure = /<cas:authenticationFailure[^>]*>([\s\S]*?)<\/cas:authenticationFailure>/.exec(xml);
  if (failure) {
    throw new LoginError(`登录失败(CAS): ${failure[1].trim()}`);
  }
  if (!/<cas:authenticationSuccess>/.test(xml)) {
    throw new LoginError("登录失败(CAS): 无法解析校验响应");
  }
  const user = /<cas:user>(.*?)<\/cas:user>/.exec(xml)?.[1] ?? "";
  const attributes: Record<string, string> = {};
  const attrBlock = /<cas:attributes>([\s\S]*?)<\/cas:attributes>/.exec(xml)?.[1] ?? "";
  const attrRe = /<cas:(\w+)>(.*?)<\/cas:\1>/g;
  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(attrBlock)) !== null) {
    attributes[match[1]] = match[2];
  }
  return {
    user_name: attributes.uid ?? attributes.employeeNumber ?? user,
    real_name: attributes.name ?? "",
    type: attributes.type ?? "",
    attributes,
  };
}

/**
 * 使用 CAS `serviceValidate` 端点校验 ticket 并返回用户信息。
 * @param ticket CAS 登录后签发的 service ticket
 * @param service 与登录时一致的 service 地址
 */
async function serviceValidate(ticket: string, service: string = SERVICE): Promise<CASUserInfo> {
  const res = await fetch(
    `https://auth.bupt.edu.cn/authserver/serviceValidate?service=${encodeURIComponent(
      service
    )}&ticket=${encodeURIComponent(ticket)}`
  );
  if (!res.ok) {
    throw new LoginError(`登录失败(CAS): ${res.status} ${res.statusText}`);
  }
  return parseCasResponse(await res.text());
}

async function getCookieAndExecution(options?: LoginOptions): Promise<{
  id: string;
  cookie: string;
  execution: string;
  captcha?: string;
}> {
  const res = await fetch(
    LOGIN_URL
  );
  const cookie = res.headers.get("set-cookie")?.split(";")?.[0];
  if (!cookie || !cookie.length) {
    throw new LoginError(`登录失败(-1): 无法获取到 cookie`);
  }
  const html = await res.text();
  const executions = html.match(/<input name="execution" value="(.*?)"/);
  if (!executions || !executions.length) {
    throw new LoginError(`登录失败(-2): 无法获取到 execution`);
  }
  const execution = executions[1];
  const capthas = html.match(/config.captcha[^{]*{[^}]*id: '(.*?)'/);
  const capthas_id = capthas?.[1];
  if (capthas_id) {
    const captchaUrl = `https://auth.bupt.edu.cn/authserver/captcha?captchaId=${capthas_id}&r=${Math.random().toString().slice(2, 7)}`;

    if (options?.onCaptcha) {
      const captchaText = await options.onCaptcha(captchaUrl, cookie);
      return {
        id: capthas_id,
        cookie,
        execution,
        captcha: captchaText,
      };
    } else if (options?.ocr) {
      const maxRetries = options.ocr.maxRetries || 3;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const captchaText = await fetch("https://ocr.byrdocs.org/ocr?" + new URLSearchParams({
            url: captchaUrl,
            token: options.ocr.token,
            cookie
          })).then(async res => {
            const data = await res.json() as { text?: string, detail?: string };
            if (!data.text) throw new OCRError("OCR 识别失败: " + (data.detail ?? "Unknown error"));
            return data.text;
          });
          return {
            id: capthas_id,
            cookie,
            execution,
            captcha: captchaText,
          };
        } catch (error) {
          lastError = error instanceof Error ? error : new OCRError(String(error));
          if (attempt < maxRetries - 1) {
            continue;
          }
        }
      }

      throw lastError!;
    } else {
      throw new LoginError(`登录失败(-3): 需要验证码，但未配置验证码处理方式`);
    }
  }
  return { id: "", cookie, execution };
}

/**
 * **login** 函数用于登录，需要传入用户名和密码。
 *
 * ```ts
 * await login("username", "password", {
 *   onCaptcha: async (url, cookie) => {
 *     console.log("Please solve captcha:", url, cookie);
 *     return await getUserInput();
 *   }
 * });
 * ```
 *
 * 注意：如果登录时需要验证码但未配置 onCaptcha，会抛出错误。
 *
 * 若 `options.cas` 为 `true`，则改用 CAS 直接校验获取用户信息，返回
 * {@link CASUserInfo}（无 token、无角色）；否则走 ucloud 返回完整的
 * {@link UserInfo} 及角色列表。返回类型会根据 `cas` 选项自动推导。
 *
 * @param username 用户名
 * @param password 密码
 * @param options 登录选项
 * @returns Promise<{@link UserInfo}> 或 Promise<{@link CASUserInfo}>
 */
export function login(
  username: string,
  password: string,
  options?: LoginOptions & { cas?: false }
): Promise<UserInfo & { roles: RoleInfo[] }>;
export function login(
  username: string,
  password: string,
  options: LoginOptions & { cas: true }
): Promise<CASUserInfo>;
export async function login(
  username: string,
  password: string,
  options?: LoginOptions
): Promise<(UserInfo & { roles: RoleInfo[] }) | CASUserInfo> {
  const sessionData = await getCookieAndExecution(options);
  const { cookie, execution } = sessionData;
  const bodyp = `username=${encodeURIComponent(
    username
  )}&password=${encodeURIComponent(password)}`;
  let response = await fetch(
    LOGIN_URL,
    {
      method: "POST",
      headers: {
        authority: "auth.bupt.edu.cn",
        "content-type": "application/x-www-form-urlencoded",
        cookie: cookie,
        referer:
          LOGIN_URL,
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36 Edg/118.0.2088.61",
      },
      body:
        bodyp +
        (sessionData.captcha ? `&captcha=${sessionData.captcha}` : "") +
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
        throw new LoginError(
          error === "Invalid credentials."
            ? "登录失败(3): 用户名或者密码错误"
            : "登录失败(4): " + error
        );
      } else throw new LoginError("登录失败(2): 未知错误");
    }
    throw new LoginError(
      "登录失败(1): " +
      response.status +
      " " +
      response.statusText +
      (error ? `(${error})` : "")
    );
  }
  const location = response.headers.get("Location");
  if (!location) {
    throw new LoginError("登录失败(5): 无法获取到重定向目标");
  }
  const urlParams = new URLSearchParams(new URL(location).search);
  const ticket = urlParams.get("ticket");
  if (!ticket) {
    throw new LoginError("登录失败(6): 无法获取到ticket");
  }
  if (options?.cas) {
    return await serviceValidate(ticket, SERVICE);
  }
  response = await fetch(
    "https://apiucloud.bupt.edu.cn/ykt-basics/oauth/token",
    {
      headers: {
        accept: "application/json, text/plain, */*",
        authorization: "Basic cG9ydGFsOnBvcnRhbF9zZWNyZXQ=",
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
    throw new LoginError(`登录失败(7): ${response.status} ${response.statusText}`);
  }

  const userInfo: UserInfo = await response.json();
  const roles = await getUserRoles(userInfo.refresh_token);

  if (roles.length === 0) {
    throw new LoginError("登录失败(8): 用户无任何角色");
  }

  return {
    ...(await refresh(
      userInfo.refresh_token,
      options?.role ?? roles[0].roleName
    )),
    roles
  }
}
