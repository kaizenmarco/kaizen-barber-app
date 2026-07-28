import React, { useState } from 'react';

function Profissionais({ t }) {
  const [profissionais, setProfissionais] = useState([
    { id: 1, nome: 'Marco Kaizen', especialidades: 'Cortes, Barba', comissao: '40%', horario_inicio: '09:00', horario_fim: '20:30', foto: '/images/marco.png' },
    { id: 2, nome: 'Gabriel Little Kaizen', especialidades: 'Cortes, Permanente', comissao: '40%', horario_inicio: '08:00', horario_fim: '19:00', foto: '/images/gabriel.jpg' },
    { id: 3, nome: 'Neia', especialidades: 'Corte Feminino, Coloração, Alisamento', comissao: '40%', horario_inicio: '09:00', horario_fim: '20:30', foto: '/images/neia.jpeg' },
  ]);

  const [novoProfissional, setNovoProfissional] = useState({
    nome: '',
    especialidades: '',
    comissao: '40%',
    horario_inicio: '',
    horario_fim: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNovoProfissional({ ...novoProfissional, [name]: value });
  };

  const handleAdicionarProfissional = (e) => {
    e.preventDefault();
    if (novoProfissional.nome && novoProfissional.especialidades) {
      setProfissionais([...profissionais, {
        id: profissionais.length + 1,
        ...novoProfissional,
        foto: '/images/placeholder.png'
      }]);
      setNovoProfissional({ nome: '', especialidades: '', comissao: '40%', horario_inicio: '', horario_fim: '' });
    }
  };

  return (
    <div className="page-container">
      <h2>{t('nav.profissionais')}</h2>

      <section className="form-section">
        <h3>Novo Profissional</h3>
        <form onSubmit={handleAdicionarProfissional}>
          <input
            type="text"
            name="nome"
            placeholder="Nome do Profissional"
            value={novoProfissional.nome}
            onChange={handleInputChange}
            required
          />
          <input
            type="text"
            name="especialidades"
            placeholder="Especialidades (ex: Cortes, Barba)"
            value={novoProfissional.especialidades}
            onChange={handleInputChange}
            required
          />
          <select
            name="comissao"
            value={novoProfissional.comissao}
            onChange={handleInputChange}
            required
          >
            <option value="40%">40% Comissão</option>
            <option value="30%">30% Comissão</option>
            <option value="50%">50% Comissão</option>
          </select>
          <input
            type="time"
            name="horario_inicio"
            placeholder="Horário Inicial"
            value={novoProfissional.horario_inicio}
            onChange={handleInputChange}
            required
          />
          <input
            type="time"
            name="horario_fim"
            placeholder="Horário Final"
            value={novoProfissional.horario_fim}
            onChange={handleInputChange}
            required
          />
          <button type="submit" className="btn-primary">Adicionar Profissional</button>
        </form>
      </section>

      <section className="profissionais-grid">
        {profissionais.map((profissional) => (
          <div key={profissional.id} className="profissional-card">
            <img src={profissional.foto} alt={profissional.nome} className="profissional-foto" />
            <div className="profissional-info">
              <h3>{profissional.nome}</h3>
              <p className="especialidades">{profissional.especialidades}</p>
              <div className="detalhes">
                <p><strong>Comissão:</strong> {profissional.comissao}</p>
                <p><strong>Horário:</strong> {profissional.horario_inicio} - {profissional.horario_fim}</p>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

export default Profissionais;