# Modelos de los bots

`guess-who-policy.json`: pesos del bot Difícil de Identidad Oculta, entrenado con aprendizaje por refuerzo en [`ml/`](../../../ml/README.md) (issue #62).

- Lo carga `server/src/infrastructure/bots/load-guess-who-bot-policy.ts` al arrancar. Si falta o no es válido, el bot Difícil juega con reglas y el servidor arranca igual.
- Se reemplaza con `python -m nexus_ml.guess_who.export` desde `ml/`. No hay que editarlo a mano.
- `GUESS_WHO_BOT_MODEL_PATH` permite usar otro archivo sin tocar este.
- El `Dockerfile` copia esta carpeta a la imagen de producción.
