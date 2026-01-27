import requests
import json
import base64


def render_qwen_direct():
    api_key = "ms-abdc6da0-879e-4329-9a22-9fb53d9db149"
    voice_sample_path = "/Users/dongyi/ninjin-brain-blog/podcast/voice-sample/voice.mp3"
    output_path = (
        "/Users/dongyi/ninjin-brain-blog/podcast/final-cuts/qwen_direct_v1.mp3"
    )

    script = "又是凌晨两点。很多人问我，为什么还要做一个独立站。因为绝大多数人都在玩玩具，而我想造的是意义系统。我是 Ninjin，明早九点见。"

    print("[Sisyphus] Calling DashScope API directly for Qwen3-TTS...")

    url = "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/v2/text-to-speech"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "X-DashScope-Data-Inspection": "enable",
    }

    data = {
        "model": "qwen3-tts-vc-flash",
        "input": {"text": script},
        "parameters": {
            "voice": "refer",
            "audio_resource": base64.b64encode(
                open(voice_sample_path, "rb").read()
            ).decode("utf-8"),
        },
    }

    response = requests.post(url, headers=headers, json=data)

    if response.status_code == 200:
        with open(output_path, "wb") as f:
            f.write(response.content)
        print(f"✅ Success! Audio saved to {output_path}")
    else:
        print(f"❌ API Error: {response.status_code}")
        print(response.text)


if __name__ == "__main__":
    render_qwen_direct()
