import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

async function main() {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'test' },
        { role: 'user', content: 'hello' }
      ],
      model: 'llama-3.1-8b-instant', 
    });
    console.log(chatCompletion.choices[0]?.message?.content);
  } catch (error) {
    console.error(error);
  }
}

main();
