const { TwitterApi } = require('twitter-api-v2');
const fs = require('fs');
require('dotenv').config({ path: '/Users/dongyi/config/x_api.env' });

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

async function postSummary() {
  try {
    // In a real run, this would read from the daily analysis file
    const text = "🚀 今日 AI 情报站已更新！\n\n核心看点：Kortix 通才 Agent 入职，迈向一人公司全自动化。\n\n查看完整研判：https://example.com/ninjin-lab\n#AI #Ninjin #Automation";
    
    const tweet = await client.v2.tweet(text);
    console.log('Daily Tweet sent successfully:', tweet.data.id);
  } catch (e) {
    console.error('Failed to send daily tweet:', JSON.stringify(e.data || e, null, 2));
  }
}

postSummary();
