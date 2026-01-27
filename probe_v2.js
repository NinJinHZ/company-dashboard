import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function probeMcp() {
    const token = "ms-abdc6da0-879e-4329-9a22-9fb53d9db149";
    const endpoint = "https://qwen-qwen3-tts.ms.show/gradio_api/mcp/sse";
    
    console.log("[Geek-Probe] Trying X-Studio-Token header...");

    const transport = new SSEClientTransport(new URL(endpoint), {
        eventSourceInitDict: {
            headers: {
                "Authorization": `Bearer ${token}`,
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Origin": "https://www.modelscope.cn",
                "Referer": "https://www.modelscope.cn/"
            }
        }
    });

    const client = new Client({ name: "ninjin-probe", version: "1.0.0" }, { capabilities: {} });
    
    try {
        await client.connect(transport);
        console.log("✅ Success with X-Studio-Token!");
        const tools = await client.listTools();
        console.log(JSON.stringify(tools, null, 2));
    } catch (e) {
        console.error("❌ X-Studio-Token failed:", e.message);
    } finally {
        await transport.close();
    }
}

probeMcp();
