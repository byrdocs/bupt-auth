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

### 只用 CAS 获取基础信息

如果只需要学号、姓名、身份类型，不需要 ucloud 的 token 和角色信息，可以传入
`cas: true`，此时直接通过统一认证的 `serviceValidate` 校验获取信息。
返回类型会根据 `cas` 选项自动推导为 `CASUserInfo`。

```ts
import { login } from "@byrdocs/bupt-auth";

const res = await login(bupt_id, bupt_pass, { cas: true });
console.log("学号:", res.user_name);   // 2021xxxxxx
console.log("姓名:", res.real_name);   // 张三
console.log("身份:", res.type);        // 例如 L0103
console.log("全部属性:", res.attributes);
```
