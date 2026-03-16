const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = 5000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const HF_MODEL = 'facebook/blenderbot-400M-distill';
const HF_API_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required.' });
  }

  const headers = { 'Content-Type': 'application/json' };
  const hfToken = process.env.HF_API_TOKEN;
  if (hfToken) {
    headers['Authorization'] = `Bearer ${hfToken}`;
  }

  const pastUserInputs = [];
  const generatedResponses = [];
  if (Array.isArray(history)) {
    for (let i = 0; i < history.length - 1; i += 2) {
      if (history[i] && history[i + 1]) {
        pastUserInputs.push(history[i].content);
        generatedResponses.push(history[i + 1].content);
      }
    }
  }

  const body = {
    inputs: {
      past_user_inputs: pastUserInputs,
      generated_responses: generatedResponses,
      text: message,
    },
    parameters: { min_length: 10, max_length: 200 },
  };

  try {
    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('HF API error:', response.status, errText);

      if (response.status === 503) {
        return res.json({
          reply: 'The AI model is loading, please try again in a moment.',
        });
      }

      return res
        .status(502)
        .json({ error: 'AI service unavailable. Please try again shortly.' });
    }

    const data = await response.json();
    const reply = data?.generated_text || 'Sorry, I could not generate a reply.';
    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
