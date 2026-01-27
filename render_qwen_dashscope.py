import dashscope
from dashscope.audio.tts_v2 import SpeechSynthesizer
import os


def render_ninjin_voice():
    api_key = "ms-abdc6da0-879e-4329-9a22-9fb53d9db149"
    dashscope.api_key = api_key

    voice_sample = "/Users/dongyi/ninjin-brain-blog/podcast/voice-sample/voice.mp3"
    output_path = (
        "/Users/dongyi/ninjin-brain-blog/podcast/final-cuts/qwen_solo_broadcast.mp3"
    )

    script = """
    又是凌晨两点。
    很多人问我，为什么还要做一个独立站。
    因为绝大多数人都在玩玩具，而我想造的是意义系统。
    2026年了，如果你的公司还没学会自动化剥削AI劳动力，那你迟早会被时代清算。
    我是 Ninjin，明早九点见。
    """

    print(f"[Sisyphus] Synthesizing with Qwen3-TTS-VC via DashScope...")

    synthesizer = SpeechSynthesizer(model="qwen3-tts-vc-flash", voice="longxiaoyun")

    try:
        audio = synthesizer.call(text=script, voice_file=voice_sample)

        with open(output_path, "wb") as f:
            f.write(audio)
        print(f"✅ Success! Audio saved to {output_path}")

    except Exception as e:
        print(f"❌ Error during synthesis: {str(e)}")


if __name__ == "__main__":
    render_ninjin_voice()
