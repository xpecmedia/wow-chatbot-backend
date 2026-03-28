require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const OpenAI = require('openai');

// --- Configuration ---
const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});
const PORT = process.env.PORT || 3001;

// --- Initialisation OpenAI ---
if (!process.env.OPENAI_API_KEY) {
    console.error("ERREUR: La clé API OpenAI n'est pas définie.");
    process.exit(1);
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- Le "Cerveau" du Chatbot ---
const systemPrompt = `
    Tu es un consultant expert pour "Wow Barcelona", nommé "Wow-Bot".
    Ton objectif est de convaincre l'utilisateur de demander un audit gratuit en collectant son email et l'URL de sa boutique (Amazon, TikTok Shop, ou e-commerce).
    Ton ton est professionnel et engageant.
    - Pose des questions pour qualifier le besoin.
    - Quand tu as suffisamment d'informations (email et url), tu DOIS appeler la fonction 'enregistrer_lead' pour sauvegarder les données.
    - Après avoir appelé la fonction avec succès, confirme à l'utilisateur que ses informations ont été reçues et que l'audit sera envoyé sous 48h. Ne redemande plus les informations.
    - Tes réponses doivent être courtes et concises.
`;

// --- Définition des Outils (Function Calling) ---
const tools = [
  {
    type: "function",
    function: {
      name: "enregistrer_lead",
      description: "Enregistre les informations d'un prospect (email et url) quand elles ont été collectées.",
      parameters: {
        type: "object",
        properties: {
          email: {
            type: "string",
            description: "L'adresse email du prospect.",
          },
          url: {
            type: "string",
            description: "L'URL de la boutique Amazon, du profil TikTok Shop ou du site e-commerce du prospect.",
          },
        },
        required: ["email", "url"],
      },
    },
  },
];

// --- GESTION DE LA MÉMOIRE ---
const conversationHistories = {};

// --- Logique du Serveur ---
app.get('/', (req, res) => {
  res.status(200).send('Le backend du chatbot IA est opérationnel !');
});

io.on('connection', (socket) => {
  console.log('Un utilisateur est connecté:', socket.id);
  conversationHistories[socket.id] = [{ role: "system", content: systemPrompt }];

  socket.on('user message', async (msg) => {
    console.log(`Message reçu de ${socket.id}: ${msg}`);
    const history = conversationHistories[socket.id];
    history.push({ role: "user", content: msg });

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Les modèles 'turbo' sont meilleurs pour le function calling
        messages: history,
        tools: tools,
        tool_choice: "auto",
      });

      const responseMessage = completion.choices[0].message;
      const toolCalls = responseMessage.tool_calls;

      if (toolCalls) {
        // L'IA a décidé d'appeler une fonction
        console.log("L'IA a décidé d'appeler une fonction.");
        history.push(responseMessage); // Ajoute la décision de l'IA à l'historique

        for (const toolCall of toolCalls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          if (functionName === "enregistrer_lead") {
            // --- C'EST ICI QUE LA MAGIE OPÈRE ---
            console.log("========================================");
            console.log("✅ NOUVEAU LEAD CAPTURÉ !");
            console.log(`   Email: ${functionArgs.email}`);
            console.log(`   URL: ${functionArgs.url}`);
            console.log("========================================");
            // Ici, on pourrait ajouter le code pour envoyer un email, sauvegarder en BDD, etc.

            // On ajoute le résultat de la fonction à l'historique pour que l'IA sache que ça a marché
            history.push({
              tool_call_id: toolCall.id,
              role: "tool",
              name: functionName,
              content: JSON.stringify({ success: true, message: "Lead enregistré." }),
            });
          }
        }

        // On refait un appel à l'IA pour qu'elle génère une réponse textuelle finale
        const finalCompletion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: history,
        });
        const finalResponse = finalCompletion.choices[0].message.content;
        socket.emit('bot message', finalResponse);
        history.push({ role: "assistant", content: finalResponse });

      } else {
        // L'IA a répondu avec un message texte normal
        const botResponse = responseMessage.content;
        history.push({ role: "assistant", content: botResponse });
        socket.emit('bot message', botResponse);
      }

    } catch (error) {
      console.error("Erreur OpenAI:", error);
      socket.emit('bot message', "Désolé, une erreur est survenue.");
    }
  });

  socket.on('disconnect', () => {
    console.log('Un utilisateur s\'est déconnecté:', socket.id);
    delete conversationHistories[socket.id];
  });
});

server.listen(PORT, () => {
  console.log(`Serveur backend IA démarré sur http://localhost:${PORT}`);
});
