import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import fs from 'fs/promises';
import 'dotenv/config';

async function testQwenCloning() {
    const token = "ms-abdc6da0-879e-4329-9a22-9fb53d9db149";
    const endpoint = "https://qwen-qwen3-tts.ms.show/gradio_api/mcp/sse";
    
    console.log("[Sisyphus] Connecting to Qwen3-TTS MCP with Token...");

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
        console.log("✅ Connection established!");
        
        const tools = await client.listTools();
        console.log("Available Tools:", JSON.stringify(tools, null, 2));
    } catch (error) {
        console.error("❌ Failed to connect:", error.message);
    } finally {
        await transport.close();
    }
}

testQwenCloning();
