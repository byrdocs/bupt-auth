import {
    login
} from ".";
import { getTestAccount, input } from "./utils";

const { bupt_id, bupt_pass } = await getTestAccount();

login(bupt_id, bupt_pass, {
    onCaptcha: async (url, cookie) => {
        console.log("需要验证码");
        console.log("\t验证码 URL:", url);
        console.log("\tCookie:", cookie);
        return await input("请输入验证码: ");
    }
}).then((res) => {
    console.log("登录成功!");
    console.log("用户名:", res.user_name);
    console.log("姓名:", res.real_name);
    console.log("角色:", res.roles.map(r => r.roleName).join(", "));
}).catch((err) => {
    console.error("登录失败:", err);
});