# Directrices de desarrollo del proyecto

Estas normas se aplican a cualquier persona o agente que analice, modifique o amplíe este repositorio. Su objetivo es mantener un proceso de desarrollo coherente, cambios fáciles de revisar y una documentación fiable de la evolución del producto.

## 1. Consultar la documentación antes de desarrollar

Antes de empezar cualquier funcionalidad, corrección o modificación, se deben localizar y leer los archivos Markdown (`.md`) relevantes que existan en el repositorio. Esto incluye este archivo, el `README.md`, el `CHANGELOG.md` y cualquier guía más específica situada en el área de trabajo afectada.

Las instrucciones más específicas para un directorio, módulo o flujo tienen prioridad dentro de su ámbito. El trabajo debe respetar las decisiones de arquitectura, convenciones, limitaciones y procesos ya documentados. Si dos documentos parecen contradecirse, se debe resolver la contradicción antes de implementar un cambio que pueda apartarse de la intención del proyecto.

## 2. Mantener actualizado el changelog

Todo cambio que afecte al comportamiento, la interfaz, la arquitectura, la configuración o la experiencia del usuario debe quedar reflejado en `CHANGELOG.md`. La entrada debe explicar el resultado observable del cambio de manera breve y concreta, no limitarse a enumerar archivos o detalles internos de implementación.

Mientras el trabajo todavía no forme parte de una versión o commit preparado, la entrada debe añadirse bajo `Unreleased`. Al preparar el commit correspondiente, esas entradas se agrupan bajo la versión asignada a dicho commit. Las correcciones relacionadas y los ajustes que formen parte del mismo trabajo deben documentarse juntos, evitando entradas duplicadas o excesivamente fragmentadas.

## 3. Versionar por commit, no por funcionalidad

No se debe incrementar la subversión por cada funcionalidad, corrección o pequeño ajuste realizado durante una misma tanda de trabajo. El número de versión se actualiza una sola vez por commit que vaya a publicarse y debe representar el conjunto completo de cambios incluidos en ese commit.

Por tanto, varias funcionalidades o correcciones incluidas en el mismo commit comparten una única versión. Antes de cerrar el commit, se deben mover o consolidar sus entradas de `Unreleased` bajo esa versión y mantener sincronizados todos los lugares donde figure el número de versión, como `package.json` y `package-lock.json`.

La elección entre una versión mayor, menor o de parche debe seguir el alcance real del conjunto de cambios y las convenciones de versionado que ya utiliza el proyecto. No se deben crear versiones intermedias únicamente porque durante el desarrollo se hayan completado varias tareas por separado.

## 4. Respetar la estructura existente y las buenas prácticas

Toda funcionalidad nueva o modificación debe integrarse siguiendo la estructura actual del repositorio. Antes de crear componentes, estilos, utilidades, rutas, traducciones o accesos a datos nuevos, se deben revisar implementaciones equivalentes y reutilizar los patrones existentes cuando sean adecuados.

En particular, el desarrollo debe:

- Mantener la separación de responsabilidades entre componentes, lógica de negocio, acceso a datos, estilos y utilidades.
- Reutilizar componentes, tipos y convenciones existentes en lugar de duplicar soluciones.
- Conservar la coherencia visual, de navegación, traducción y accesibilidad de la aplicación.
- Evitar cambios innecesarios o refactorizaciones ajenas al objetivo de la tarea.
- Mantener compatibilidad con los flujos existentes y proteger los datos del usuario.
- Añadir o actualizar pruebas cuando el comportamiento modificado lo requiera y ejecutar las comprobaciones disponibles en proporción al riesgo del cambio.
- Revisar que el código quede legible, tipado, mantenible y sin errores de formato antes de dar el trabajo por terminado.

Si una solución exige apartarse de la estructura o de los patrones actuales, la razón debe estar justificada por una mejora clara y debe documentarse cuando afecte a futuras decisiones de desarrollo.
