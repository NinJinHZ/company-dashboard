import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import fs from 'fs';

async function officialRender() {
    const token = "ms-abdc6da0-879e-4329-9a22-9fb53d9db149";
    const endpoint = "https://qwen-qwen3-tts.ms.show/gradio_api/mcp/sse";
    const outputPath = "/Users/dongyi/ninjin-brain-blog/podcast/final-cuts/qwen_official_path.mp3";
    
    console.log("[Official-Path] Establishing connection via authorized SSE...");

    const transport = new SSEClientTransport(new URL(endpoint), {
        eventSourceInitDict: {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        }
    });

    const client = new Client({ name: "ninjin-official-client", version: "1.0.0" }, { capabilities: {} });
    
    try {
        await client.connect(transport);
        
        const result = await client.callTool("predict", {
            fn_index: 0, 
            data: [
                "又是凌晨两点。我是 Ninjin。这不仅是一段音频，这是我的数字生命在算法中的第一次呼吸。",
                "voice.mp3"
            ]
        });

        console.log("✅ Synthesis Complete!");
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2)); 
        console.log(`Response archived at ${outputPath}. Check for audio URL.`);
        
    } catch (e) {
        console.error("❌ Official Path Error:", e.message);
    } finally {
        await transport.close();
    }
}

officialRender();
