"use client";

import { useState, type FormEvent } from "react";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type Simulation = { financed: number; payment: number; total: number };

export function FinanceSimulator() {
  const [propertyPrice, setPropertyPrice] = useState("500000");
  const [downPayment, setDownPayment] = useState("100000");
  const [annualRate, setAnnualRate] = useState("");
  const [term, setTerm] = useState("360");
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [error, setError] = useState("");

  function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const price = Number(propertyPrice);
    const down = Number(downPayment);
    const yearlyRate = Number(annualRate);
    const months = Number(term);

    if (price <= 0 || down < 0 || down >= price || annualRate === "" || yearlyRate < 0 || yearlyRate > 100) {
      setSimulation(null);
      setError("Confira o valor do imóvel, a entrada e a taxa anual informada pelo banco.");
      return;
    }

    const financed = price - down;
    const monthlyRate = Math.pow(1 + yearlyRate / 100, 1 / 12) - 1;
    const payment = monthlyRate === 0
      ? financed / months
      : financed * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));

    setError("");
    setSimulation({ financed, payment, total: down + payment * months });
  }

  return (
    <div className="estate-simulator__grid">
      <div className="estate-simulator__copy">
        <span className="estate-eyebrow">Simulador</span>
        <h2>Tenha uma estimativa antes de dar o próximo passo.</h2>
        <p>Informe a taxa anual efetiva apresentada pelo banco para calcular uma parcela aproximada pelo sistema Price.</p>
        <ul>
          <li>Use a taxa da proposta que você recebeu.</li>
          <li>Compare o resultado com as condições completas do financiamento.</li>
        </ul>
      </div>

      <form className="estate-simulator__card" onSubmit={calculate}>
        <label>Valor do imóvel (R$)<input type="number" min="1" step="1000" value={propertyPrice} onChange={(event) => setPropertyPrice(event.target.value)} required /></label>
        <label>Entrada (R$)<input type="number" min="0" step="1000" value={downPayment} onChange={(event) => setDownPayment(event.target.value)} required /></label>
        <div className="estate-simulator__row">
          <label>Taxa anual efetiva (%)<input type="number" min="0" max="100" step="0.01" placeholder="Informe a taxa do banco" value={annualRate} onChange={(event) => setAnnualRate(event.target.value)} required /></label>
          <label>Prazo<select value={term} onChange={(event) => setTerm(event.target.value)}><option value="120">10 anos</option><option value="240">20 anos</option><option value="360">30 anos</option><option value="420">35 anos</option></select></label>
        </div>
        <button className="estate-button estate-button--wide" type="submit">Calcular estimativa <span aria-hidden="true">↗</span></button>
        {error && <p className="estate-simulator__error" role="alert">{error}</p>}
        {simulation && <div className="estate-simulator__result" role="status" aria-live="polite">
          <div><span>Parcela estimada</span><strong>{money.format(simulation.payment)}</strong></div>
          <div><span>Valor financiado</span><strong>{money.format(simulation.financed)}</strong></div>
          <div><span>Total aproximado com entrada</span><strong>{money.format(simulation.total)}</strong></div>
        </div>}
        <small>Estimativa matemática. Não inclui seguros, tarifas, impostos nem outras condições do banco; não é uma proposta de crédito.</small>
      </form>
    </div>
  );
}
