import { login, CaptchaError, RoleSelect, type UserInfo } from ".";
import { getTestAccount, input } from "./utils";

const { bupt_id, bupt_pass } = await getTestAccount();

async function login_auth(): Promise<UserInfo> {
    try {
        const res = await login(bupt_id, bupt_pass,undefined,RoleSelect.Student);
        return res;
    } catch (e) {
        if (e instanceof CaptchaError) {
            console.log("Captchas required. ")
            console.log("\tCaptcha URL: ", e.captcha());
            console.log("\tCookie:", e.cookie())
            const captcha = await input("Captcha: ");
            const res = await e.resolve(captcha);
            return res;
        } else {
            throw e;
        }
    }
}

console.log(await login_auth());