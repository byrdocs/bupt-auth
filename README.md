# bupt-auth

[![API Docs](https://img.shields.io/badge/API%20Docs-green
)](https://jsr.io/@byrdocs/bupt-auth/doc) [![Publish](https://github.com/byrdocs/bupt-auth/actions/workflows/publish.yml/badge.svg)](https://github.com/byrdocs/bupt-auth/actions/workflows/publish.yml)

北京邮电大学统一身份认证。

## 安装

```sh
# pnpm
pnpm dlx jsr add @byrdocs/bupt-auth
# bun
bunx jsr add @byrdocs/bupt-auth
```

详见 [jsr.io/@byrdocs/bupt-auth](https://jsr.io/@byrdocs/bupt-auth)。

## 使用

```ts
import { login } from "@byrdocs/bupt-auth";

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
```