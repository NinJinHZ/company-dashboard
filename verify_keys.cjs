const { TwitterApi } = require('twitter-api-v2');
require('dotenv').config({ path: '/Users/dongyi/config/x_api.env' });

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

(async () => {
  try {
    const user = await client.v2.me();
    console.log('✅ Key Verification Success!');
    console.log('Account:', user.data.username);
    console.log('ID:', user.data.id);
  } catch (e) {
    console.error('❌ Verification failed:', JSON.stringify(e.data || e, null, 2));
  }
})();
