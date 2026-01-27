import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function listQwenTools() {
    const transport = new SSEClientTransport(new URL("https://qwen-qwen3-tts.ms.show/gradio_api/mcp/sse"));
    const client = new Client({ name: "ninjin-tester", version: "1.0.0" }, { capabilities: {} });
    
    await client.connect(transport);
    const tools = await client.listTools();
    console.log(JSON.stringify(tools, null, 2));
    await transport.close();
}

listQwenTools().catch(console.error);
