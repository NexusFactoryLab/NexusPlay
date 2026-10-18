# ml/ — entrenamiento de los bots

Aquí se entrena con aprendizaje por refuerzo el bot de **Identidad Oculta** (dificultad Difícil) para las partidas en solitario (issue #62).

Es una carpeta aparte del backend a propósito:
- Es Python y **solo se usa en desarrollo**. No se despliega: el `Dockerfile` no la copia.
- Al servidor solo llega el resultado, un JSON de pesos en `server/assets/bots/guess-who-policy.json`. El servidor calcula la red en TypeScript, sin Python ni dependencias nativas.

## Cómo encaja con el servidor

```
servidor (TypeScript)                         ml/ (Python)
─────────────────────                         ────────────
reglas reales ──► contracts/guess-who/*.json ──► simulador (rules.py, features.py)
                  (los escribe una prueba        │  las pruebas comparan contra
                   del servidor)                 │  esos mismos archivos
                                                 ▼
                                              entorno Gymnasium (env.py)
                                                 │  MaskablePPO (train.py)
                                                 ▼
MlpGuessWhoBotPolicy ◄── guess-who-policy.json ◄─ export.py (+ policy.onnx)
```

El modelo **no ve tarjetas concretas**. Ve un estado abstracto:
- cuántas candidatas le quedan a él y cuántas tarjetas le quedan al rival;
- si ya puede acusar y si ya preguntó en este turno;
- cómo parte cada una de las 6 preguntas sugeridas.

Por eso un solo modelo sirve para cualquier juego: banderas, animales o lo que arme un docente. Sus acciones son:
- hacer la pregunta sugerida *k*;
- acusar (a una candidata al azar);
- pasar.

Lo que el bot ya sabe que no es la carta del rival (su propia carta y sus acusaciones fallidas) lo descarta antes de decidir, tanto en el entrenamiento como en el servidor. Fácil y Medio no usan el modelo, porque sus errores son a propósito.

## Instalación

Requiere Python 3.11 o más reciente.

```bash
cd ml
py -m venv .venv                      # Windows (en macOS/Linux: python3 -m venv .venv)
.venv/Scripts/python -m pip install -e ".[dev]"   # en macOS/Linux: .venv/bin/python
```

## Flujo de trabajo

```bash
# 1. Pruebas: el simulador debe coincidir con el servidor
.venv/Scripts/python -m pytest

# 2. Entrenar (unos minutos en CPU)
.venv/Scripts/python -m nexus_ml.guess_who.train --timesteps 1000000 --out runs/guess-who

# 3. Exportar para el servidor (comprueba que sb3, el JSON y ONNX den lo mismo)
.venv/Scripts/python -m nexus_ml.guess_who.export --model runs/guess-who/policy.zip \
    --training runs/guess-who/training.json \
    --out ../server/assets/bots/guess-who-policy.json --onnx models/guess-who-policy.onnx

# 4. Comparar el modelo exportado contra el bot por reglas
.venv/Scripts/python -m nexus_ml.guess_who.evaluate --weights ../server/assets/bots/guess-who-policy.json
```

Al reiniciar, el servidor muestra en el log qué usa el bot Difícil: «modelo entrenado» o «reglas».

## Si cambian las reglas del juego en el servidor

Las pruebas de contrato fallan a propósito: el bot estaría aprendiendo un juego que ya no existe.

1. Regenera los casos desde el servidor:
   `cd server && WRITE_ML_FIXTURES=1 npx vitest run src/application/bots/guess-who-ml-contract.spec.ts`
2. Ajusta `rules.py` o `features.py` hasta que `pytest` pase.
3. Vuelve a entrenar y exportar. Si cambió la entrada del modelo, el servidor rechaza los pesos viejos y juega con reglas hasta que exportes los nuevos.

## Modelo actual y lo que aprendió

Entrenado con 1.000.000 de pasos (7 minutos en CPU). Resultados con 5.000 partidas por política, en semillas distintas de las del entrenamiento y contra la misma mezcla de rivales simulados:

| Rival | Bot por reglas (Difícil) | Modelo |
|---|---|---|
| cuidadoso | 66,6 % | 80,1 % |
| casual | 85,5 % | 90,3 % |
| rápido (2 preguntas por turno) | 30,5 % | 45,7 % |
| arriesgado | 37,3 % | 53,6 % |
| bot Difícil por reglas | 52,9 % | 66,9 % |
| **Total** | **54,6 %** | **67,3 %** |

**Qué aprendió:**
- Siempre hace la pregunta que mejor parte a sus candidatas, igual que el bot por reglas.
- **Acusa en cuanto puede, con cualquier cantidad de candidatas.**

Con las reglas actuales es lo óptimo: acusar mal solo hace perder un turno que de todos modos terminaba. Una regla de una línea ("acusar siempre que se pueda") da exactamente el mismo resultado. El costo para quien juega contra él es ver unas 1,6 acusaciones fallidas del bot por partida, contra 0,6 del bot por reglas.

El entrenamiento descubrió un hueco de las reglas. Si acusar mal tuviera un costo (por ejemplo, perder el turno siguiente o un límite de acusaciones), habría una decisión de verdad entre arriesgar y esperar. Ahí el modelo aprendería algo que una regla simple no da: basta con cambiar la regla en el servidor y en `rules.py`, y volver a entrenar.

El resumen completo del entrenamiento está en `models/guess-who-training.json`.

## Archivos

| Archivo | Qué hace |
|---|---|
| `nexus_ml/guess_who/rules.py` | Preguntas guiadas, descartes y acusación: espejo de `guided-questions.ts` y `guess-who-rules.ts` |
| `nexus_ml/guess_who/features.py` | Entrada (18 números) y máscara de acciones del modelo: espejo de `guess-who-policy-features.ts` |
| `nexus_ml/guess_who/deck.py` | Mazos al azar de 12 a 40 tarjetas; un 15 % sin rasgos |
| `nexus_ml/guess_who/opponents.py` | Rivales simulados: cuidadoso, casual, rápido (2 preguntas por turno), arriesgado y bot Difícil por reglas |
| `nexus_ml/guess_who/env.py` | Entorno Gymnasium con máscara de acciones |
| `nexus_ml/guess_who/policies.py` | Bot por reglas (referencia), modelo exportado y acciones al azar |
| `nexus_ml/guess_who/train.py` · `evaluate.py` · `export.py` | Entrenar, comparar y exportar |
| `contracts/guess-who/` | Casos compartidos con el servidor. No se editan a mano |
| `models/` | El modelo actual en ONNX y el resumen de su entrenamiento |
