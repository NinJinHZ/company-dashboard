import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function listGradioTools() {
    const token = "ms-abdc6da0-879e-4329-9a22-9fb53d9db149";
    const endpoint = "https://qwen-qwen3-tts.ms.show/gradio_api/mcp/sse";
    
    console.log("[Sisyphus] Connecting to Gradio-Native MCP...");

    const transport = new SSEClientTransport(new URL(endpoint), {
        eventSourceInitDict: {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        }
    });

    const client = new Client({ name: "ninjin-orchestrator", version: "1.0.0" }, { capabilities: {} });
    
    try {
        await client.connect(transport);
        const tools = await client.listTools();
        console.log("TOOL_LIST_START");
        console.log(JSON.stringify(tools, null, 2));
        console.log("TOOL_LIST_END");
    } catch (e) {
        console.error("Connection failed:", e.message);
    } finally {
        await transport.close();
    }
}

listGradioTools();
