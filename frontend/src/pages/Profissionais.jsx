import React, { useState } from 'react';

function Profissionais({ t }) {
  const [profissionais, setProfissionais] = useState([
    { id: 1, nome: 'Marco Kaizen', especialidades: 'Cortes, Barba', comissao: '40%', horario_inicio: '09:00', horario_fim: '20:30' },
    { id: 2, nome: 'Gabriel Little Kaizen', especialidades: 'Cortes, Barba, Permanente', comissao: '40%', horario_inicio: '08:00', horario_fim: '19:00' },
    { id: 3, nome: 'Neia', especialidades: 'Corte Feminino, Coloração, Alisamento', comissao: '40%', horario_inicio: '09:00', horario_fim: '20:30' },
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
        ...novoProfissional
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

      <section className="list-section">
        <h3>Lista de Profissionais</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Especialidades</th>
              <th>Comissão</th>
              <th>Horário</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {profissionais.map((profissional) => (
              <tr key={profissional.id}>
                <td>{profissional.nome}</td>
                <td>{profissional.especialidades}</td>
                <td>{profissional.comissao}</td>
                <td>{profissional.horario_inicio} - {profissional.horario_fim}</td>
                <td>
                  <button 
                    className="btn-delete"
                    onClick={() => setProfissionais(profissionais.filter(p => p.id !== profissional.id))}
                  >
                    Deletar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default Profissionais;