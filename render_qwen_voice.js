import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import fs from 'fs';
import { promisify } from 'util';
import { pipeline } from 'stream';

const streamPipeline = promisify(pipeline);

async function renderNinjinVoice() {
    const token = "ms-abdc6da0-879e-4329-9a22-9fb53d9db149";
    const endpoint = "https://qwen-qwen3-tts.ms.show/gradio_api/mcp/sse";
    const voiceSamplePath = "/Users/dongyi/ninjin-brain-blog/podcast/voice-sample/voice.mp3";
    const outputPath = "/Users/dongyi/ninjin-brain-blog/podcast/final-cuts/first_broadcast.mp3";
    
    console.log("[Sisyphus] Activating Qwen3-TTS via MCP...");

    const transport = new SSEClientTransport(new URL(endpoint), {
        eventSourceInitDict: {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        }
    });

    const client = new Client({ name: "ninjin-super-company", version: "1.0.0" }, { capabilities: {} });
    
    try {
        await client.connect(transport);
        
        const script = "又是凌晨两点。很多人问我，为什么还要做一个独立站。因为绝大多数人都在玩玩具，而我想造的是意义系统。我是 Ninjin，明早九点见。";
        
        console.log("[Sisyphus] Sending voice sample and script for cloning...");
        
        const result = await client.callTool("predict", {
            fn_index: 0,
            data: [
                script,
                { "name": "voice.mp3", "data": `data:audio/mp3;base64,${fs.readFileSync(voiceSamplePath).toString('base64')}` }
            ]
        });

        console.log("✅ Audio Rendered!");
        fs.writeFileSync(outputPath, Buffer.from(result.content[0].text, 'base64'));
        
    } catch (error) {
        console.error("❌ MCP Execution Error:", error.message);
    } finally {
        await transport.close();
    }
}

renderNinjinVoice();
