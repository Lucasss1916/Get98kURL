export default {
    async fetch(request, env, ctx) {
      // ================= 配置区域 =================
      const ACCESS_PASSWORD = "islucas1now"; 
      // 伪装成浏览器，确保能拿到 Base64 内容
      const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      // ===========================================
  
      // 0. 检查环境变量
      if (!env.EMAIL || !env.PASSWORD) {
          return new Response("❌ 错误: 请在 Cloudflare 后台设置 EMAIL 和 PASSWORD 变量", { status: 500 });
      }
  
      const url = new URL(request.url);
      if (url.searchParams.get("password") !== ACCESS_PASSWORD) {
          return new Response("❌ 401 Unauthorized", { status: 401 });
      }
  
      // 通用请求头
      const commonHeaders = {
          "User-Agent": BROWSER_UA,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
      };
  
      try {
          // Step 1: 登录
          const loginResp = await fetch("https://98kjc.top/api/v1/passport/auth/login", {
              method: "POST",
              headers: { ...commonHeaders, "Content-Type": "application/json" },
              body: JSON.stringify({ email: env.EMAIL, password: env.PASSWORD })
          });
  
          const loginText = await loginResp.text();
          let loginJson;
          try {
              loginJson = JSON.parse(loginText);
          } catch (e) {
              return new Response(`❌ 登录响应异常: ${loginText.substring(0, 100)}`, { status: 500 });
          }
  
          const token = loginJson?.data?.auth_data;
          if (!token) return new Response(`❌ 登录失败: ${loginJson?.message}`, { status: 500 });
  
          // Step 2: 获取订阅链接 (这里同时也包含了流量信息！)
          const timestamp = Date.now();
          const subInfoResp = await fetch(`https://98kjc.top/api/v1/user/getSubscribe?t=${timestamp}`, {
              method: "GET",
              headers: { ...commonHeaders, "Authorization": token, "Referer": "https://98kjc.top/" }
          });
  
          const subInfoJson = await subInfoResp.json();
          const subData = subInfoJson?.data;
          const subscribeUrl = subData?.subscribe_url;
  
          if (!subscribeUrl) return new Response("❌ 未找到订阅 URL", { status: 500 });
  
          // ========================================================
          // 【核心修复】直接从 API JSON 中构造流量信息头
          // 这样比去抓取 header 更稳定，绝对不会丢失
          // ========================================================
          let userInfoStr = "";
          if (subData) {
              // d: 已用下载, u: 已用上传, transfer_enable: 总流量, expired_at: 过期时间戳
              // 如果 API 返回了这些数据，我们就自己拼装
              if (subData.transfer_enable) {
                  const total = subData.transfer_enable;
                  const used = (subData.u || 0) + (subData.d || 0);
                  const expire = subData.expired_at || 0;
                  userInfoStr = `upload=${subData.u || 0}; download=${subData.d || 0}; total=${total}; expire=${expire}`;
              }
          }
  
          // Step 3: 下载订阅内容
          const contentResp = await fetch(subscribeUrl, {
              method: "GET",
              headers: commonHeaders
          });
  
          const content = await contentResp.text();
  
          // Step 4: 返回给 SubStore
          const newHeaders = new Headers();
          newHeaders.set("Content-Type", "text/plain; charset=utf-8"); // 强制纯文本
          
          // 优先使用我们从 API 拼装的流量信息
          if (userInfoStr) {
              newHeaders.set("Subscription-Userinfo", userInfoStr);
          } else {
              // 如果 API 没给，再尝试从下载链接的 Header 里捡漏
              const remoteHeader = contentResp.headers.get("Subscription-Userinfo") || contentResp.headers.get("subscription-userinfo");
              if (remoteHeader) newHeaders.set("Subscription-Userinfo", remoteHeader);
          }
  
          // 加上这个头，确保 SubStore 前端能读取到
          newHeaders.set("Access-Control-Expose-Headers", "Subscription-Userinfo");
  
          return new Response(content, {
              status: 200,
              headers: newHeaders
          });
  
      } catch (err) {
          return new Response(`❌ Worker 异常: ${err.message}`, { status: 500 });
      }
    }
  };
