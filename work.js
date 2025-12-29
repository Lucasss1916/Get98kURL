export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const password = url.searchParams.get("password");

    // 密码验证,更改为自己的密码
    const correctPassword = "islucas1now";
    if (password !== correctPassword) {
      return new Response("❌ Password incorrect", { status: 401 });
    }

    // 登录第一步
    const loginResp = await fetch("https://98kjc.top/api/v1/passport/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0"
      },
      body: JSON.stringify({
        email: env.EMAIL,
        password: env.PASSWORD
      })
    });

    const loginJson = await loginResp.json();
    const token = loginJson?.data?.auth_data;

    if (!token) {
      return new Response("❌ 登录失败", { status: 500 });
    }

    // 第二步：获取订阅链接
    const timestamp = Date.now();
    const subscribeResp = await fetch(`https://98kjc.top/api/v1/user/getSubscribe?t=${timestamp}`, {
      method: "GET",
      headers: {
        "Authorization": token,
        "Referer": "https://98kjc.top/",
        "User-Agent": "Mozilla/5.0"
      }
    });

    const subJson = await subscribeResp.json();
    const subscribeUrl = subJson?.data?.subscribe_url;

    if (!subscribeUrl) {
      return new Response("❌ 获取订阅链接失败", { status: 500 });
    }

    // 第三步：访问订阅链接内容
    // 【修改处】：添加了 headers 对象和 User-Agent
    const contentResp = await fetch(subscribeUrl, {
        method: "GET",
        headers: {
            "User-Agent": "Mozilla/5.0" 
        }
    });
    
    const content = await contentResp.text(); 

    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8" // 建议加上 charset=utf-8 防止乱码
      }
    });
  }
};
