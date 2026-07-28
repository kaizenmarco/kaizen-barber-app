import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.post('/api/auth/login', (req, res) => {
  const { email } = req.body;
  res.json({
    token: 'demo_token',
    usuario: {
      id: '1',
      email: email,
      nome: 'Marco',
      role: 'ADMIN'
    }
  });
});

app.get('/api/relatorios/dia/:data', (req, res) => {
  res.json({
    agendamentos: 5,
    receita_bruta: 25000,
    despesas: 2000,
    lucro_liquido: 23000
  });
});

app.listen(PORT, () => {
  console.log(`🏳️ Kaizen API rodando em localhost:${PORT}`);
});