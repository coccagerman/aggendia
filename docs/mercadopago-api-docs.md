---
product_landing_hero:
    - title: Integra Suscripciones y configura cobros recurrentes
    - message: Esta solución permite que tus clientes se suscriban a productos y servicios, realizando pagos recurrentes de forma automática.
    - benefit_icon: to-agree
    - benefit_title: Gestión ágil
    - benefit_icon: recurring-payments
    - benefit_title: Cobros recurrentes
    - benefit_icon: laptop
    - benefit_title: Frecuencia personalizable
    - benefit_icon: protected-purchase
    - benefit_title: Reintentos de cobro automáticos
    - info: ¿Buscas opciones sin desarrollo? Explora [más soluciones](/developers/es/docs#online-payments).
---

---

product_landing_what_it_offers:

- title: Qué ofrece
- message: Realiza cobranzas recurrentes, automatizadas y con una experiencia simplificada para tus clientes, aumentando tu conversión y facturación.
- benefit_title: Conversión
- benefit_bullet: Cobro ágil con los medios de pago guardados en Mercado Pago.
- benefit_bullet: Opción de pagar sin cuenta de Mercado Pago.
- benefit_bullet: Medios de pago online y offline, como Rapipago y Pago Fácil.
- benefit_bullet: Ofrece un período de prueba para que los clientes conozcan tu servicio.
- benefit_title: Aprobación de pagos
- benefit_bullet: Reintentos automáticos si un cobro es rechazado.
- benefit_bullet: Actualización automática del estado de las tarjetas por parte de las principales banderas.
- benefit_title: Personalización
- benefit_bullet: Frecuencia de cobro personalizable: semanal, mensual o anual.
- benefit_bullet: Redirecciona a una URL personalizable después de la aprobación del pago inicial.
- benefit_bullet: Crea suscripciones para grupos o personalizada para cada cliente.
- benefit_bullet: Permite que los suscriptores elijan cuánto pagar - ideal para donaciones.
- benefit_title: Seguridad contra fraudes
- benefit_bullet: Herramientas de prevención de fraudes y verificación de identidad del cliente.

---

---

product_landing_how_works:

- title: Cómo funciona
- message: Creas una suscripción a través de nuestra API definiendo la frecuencia deseada, y compartes el enlace de pago en tu sitio o directamente con tus clientes. Después del primer pago vía Mercado Pago, los cobros siguientes ocurren automáticamente, sin necesidad de enviar recordatorios.
- sub_title: Proceso de cobro
- image: https://http2.mlstatic.com/storage/dx-devsite/docs-assets/custom-upload/2025/5/12/1749740599583-subscriptionses.gif
- image_text: Quiero comenzar a integrar
- image_text_link: /developers/es/docs/subscription-plans/create-subscription-plan
- list_title: El comprador accede al enlace de la suscripción que enviaste.
- list_title: Luego, es redirigido al formulario de pago, donde puede elegir entre usar una cuenta de Mercado Pago o continuar sin cuenta.
- list_title: En el formulario, puede seleccionar el medio de pago deseado - ya sea uno guardado en la cuenta o uno nuevo para agregar.
- list_title: Después de completar el pago, el cliente pasa a estar inscrito en la suscripción y será cobrado de acuerdo con la periodicidad definida.
- button_description: Comenzar a integrar
- button_link: /developers/es/docs/subscriptions/integration-configuration/subscription-associated-plan

---

---

product_landing_what_differentiates:

- title: Qué lo diferencia
- message: Compara nuestras soluciones de pago online y elige el que mejor se adapte a tu negocio. Consulta las tarifas. Consulta las [tarifas](https://www.mercadopago[FAKER][URL][DOMAIN]/ayuda/33399).
- columns_amount: 3
- column_product: Suscripciones
- column_button_text: Cómo crear
- column_button_link: /developers/es/docs/subscriptions/overview
- column_product: Link de pago
- column_button_text: Ir al sitio
- column_button_link: https://www.mercadopago[FAKER][URL][DOMAIN]/herramientas-para-vender/link-de-pago
- column_product: Planes de suscripción
- column_button_text: Ir al resumen
- column_button_link: /developers/es/docs/subscription-plans/create-subscription-plan
- line_text: Esfuerzo de integración
- line_type: dots
- line_values: 3|1|1
- line_text: Nivel de personalización
- line_type: dots
- line_values: 4|1|4
- line_text: Experiencia de pago
- line_type: text
- line_values: Ambiente de Mercado Pago|Ambiente de Mercado Pago|Ambiente de Mercado Pago
- line_text: Pagos recurrentes
- line_type: check
- line_values: true|false|true
- line_text: Medios de pago
- line_type: text
- line_values: Dinero en cuenta, tarjeta de crédito o débito, Línea de crédito, Rapipago, Pago Fácil.|Dinero en cuenta, tarjeta de crédito o débito, Línea de crédito, Rapipago, Pago Fácil.|Dinero en cuenta, tarjeta de crédito o débito, Línea de crédito, Rapipago, Pago Fácil.
- line_text: Disponibilidad por país
- line_type: sites
- line_values: all|all|all

---

---

product_landing_how_integrate:

- title: Cómo integrar
- sub_title: Conheça as etapas necessárias para integrar esta solução.
- requirement_title: Requisitos previos
- requirement_table_title: Cuenta de vendedor
- requirement_table_list: Para integrar Subscripciones, necesitas ingresar a Mercado Pago y [crear una cuenta de vendedor](https://www.mercadopago[FAKER][URL][DOMAIN]/hub/registration/landing).
- requirement_table_title: Aplicación de Mercado Pago
- requirement_table_list: Crea tu aplicación en [Tus integraciones](/developers/es/docs/subscriptions/additional-content/your-integrations/dashboard#:~:text=En%20el-,Panel%20del%20desarrollador,-%2C%20encontrar%C3%A1s%20la%20lista) y obtén tus credenciales para integrarte con Mercado Pago.
- requirement_table_title: Credenciales
- requirement_table_list: Claves de acceso únicas con las que identificamos una integración en tu cuenta. Para más información, accede a la [documentación](/developers/es/docs/subscriptions/additional-content/your-integrations/credentials).

---

## |||column1|||

product_landing_how_integrate:

- list_title: Proceso de integración
- list_item: Crear una suscripción, con o sin plan asociado, a través de llamados a nuestra API de Suscripciones.
- list_item: Configurar el prorrateo, en caso de que quieras ofrecerlo.
- list_item: Probar la integración.
- list_item: Salir a producción.
- button_description: Quiero comenzar a integrar
- button_link: /developers/es/docs/subscriptions/integration-configuration/subscription-associated-plan

---

|||column2|||

<pre class="mermaid">
  flowchart TD
            A["Crear una suscripción vía API"]
            A --> B1["Con plan asociado"]
            A --> B2["Sin plan asociado"]
            B1 --> C["Probar la integración"]
            B2 --> C
            C --> D["Salir a producción"]
</pre>

|||

# Suscripciones con plan asociado

Las suscripciones con plan asociado se utilizan cuando es necesario utilizar la misma suscripción en diferentes ocasiones para organizarlas en grupos identificables. Por ejemplo, para una suscripción mensual y anual a un gimnasio.

La integración de **suscripciones con plan asociado** se realiza en dos pasos. En el primero es necesario **crear un plan** que irá asociado a la suscripción y en el segundo, la **creación de la suscripción**.

## Crear plan

El plan de suscripción te permite definir, entre otros atributos, el título, el valor y la frecuencia de las suscripciones creadas por el vendedor. Para crear un plan y asociarlo con una suscripción, mira el endpoint [/preapproval_plan](/developers/es/reference/subscriptions/_preapproval_plan/post), completa los atributos necesarios y ejecuta el request o, si prefieres, usa el _curl_ a continuación.

> NOTE
>
> Nota
>
> Al ejecutar la API, se creará el plan y tendrás acceso a `preapproval_plan_id`, **que en la respuesta de la API se mostrará como `id`**. Este **atributo es obligatorio** para crear la suscripción.

[[[

```curl
curl -X POST \

      'https://api.mercadopago.com/preapproval_plan' \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
      -H 'Content-Type: application/json' \
      -d '{
  "reason": "Yoga classes",
  "auto_recurring": {
    "frequency": 1,
    "frequency_type": "months",
    "repetitions": 12,
    "billing_day": 10,
    "billing_day_proportional": true,
    "free_trial": {
      "frequency": 1,
      "frequency_type": "months"
    },
    "transaction_amount": 10,
    "currency_id": "ARS"
  },
  "payment_methods_allowed": {
    "payment_types": [
      {}
    ],
    "payment_methods": [
      {}
    ]
  },
  "back_url": "https://www.yoursite.com"
}'
```

]]]

> WARNING
>
> Importante
>
> Una _Suscripción con plan asociado_ siempre deberá ser creada con su `card_token_id` y en status `Authorized`.

¡Listo! Ya creaste el plan de su suscripción con plan asociado. Para finalizar la integración, ahora deberás **crear una suscripción**.

## Crear suscripción

La suscripción es una autorización del pagador para cargos recurrentes con un medio de pago definido (tarjeta de crédito, por ejemplo). Al suscribirse a un producto/servicio, el cliente acepta que se le cobre periódicamente un cierto monto por el período de tiempo definido.

Para crear una suscripción, primero deberás contar con el valor `preapproval_plan_id`.

Luego, podrás continuar la integración por dos caminos: puedes acceder al endpoint [/preapproval](/developers/es/reference/subscriptions/_preapproval/post) y completar los atributos como se indica en la tabla de parámetros, o también puedes usar el _curl_ que te compartimos a continuación.

[[[

```curl

curl -X POST \
      'https://api.mercadopago.com/preapproval' \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
      -H 'Content-Type: application/json' \
      -d '{
  "preapproval_plan_id": "2c938084726fca480172750000000000",
  "reason": "Yoga classes",
  "external_reference": "YG-1234",
  "payer_email": "test_user@testuser.com",
  "card_token_id": "e3ed6f098462036dd2cbabe314b9de2a",
  "auto_recurring": {
    "frequency": 1,
    "frequency_type": "months",
    "start_date": "2020-06-02T13:07:14.260Z",
    "end_date": "2022-07-20T15:59:52.581Z",
    "transaction_amount": 10,
    "currency_id": "ARS"
  },
  "back_url": "https://www.mercadopago.com.ar",
  "status": "authorized"
}'
```

]]]

Cuando termines de llenar los atributos, ejecuta el request y ¡listo! Ya habrás creado la suscripción con el plan asociado.

# Cuentas de prueba

Utiliza cuentas de prueba para asegurar que tu integración soporta todos los flujos y escenarios posibles. Tienen las mismas características que una cuenta real de Mercado Pago, lo que te permite probar el funcionamiento de las integraciones que estás desarrollando.

> WARNING
>
> Importante
>
> Las integraciones con [Checkout Bricks](/developers/es/docs/checkout-bricks/landing) no soportan usuarios de prueba para realizar pruebas de integración. Por este motivo, no podrás acceder a esta sección desde una aplicación creada este producto. Para más información, visita la documentación [Hacer compra de prueba](/developers/es/docs/checkout-bricks/integration-test/test-payment-flow) con Checkout Bricks.

Para realizar las pruebas, debes tener al menos dos cuentas:

- **Vendedor**: cuenta requerida para **configurar la aplicación y las credenciales**. Esta es tu cuenta de usuario.
- **Comprador**: cuenta necesaria para **probar el proceso de compra**.
- **Integrador**: cuenta que se usa en **integraciones del modelo marketplace**.

Además de estas cuentas, también es importante utilizar las [tarjetas de prueba](/developers/es/docs/your-integrations/test/cards) para probar la integración de pago y simular el proceso de compra, así como el **saldo en la cuenta de Mercado Pago del usuario de prueba**. Te mostramos más detalles a continuación.

![formulario para crear test user](/images/snippets/test-cross/test-user-es-create-seller.png)

Para crear cuentas y probar el funcionamiento de las integraciones, sigue los siguientes pasos:

1. En [Mercado Pago Developers](/developers/es/docs), navega hasta **[Tus integraciones](/developers/panel/app)** y haz clic en la aplicación con la que desees trabajar.
2. En la página de la aplicación, ve a la sección **Cuentas de prueba** y haz clic en el botón **Crear cuenta de prueba**.
3. En la pantalla "Crear nueva cuenta", selecciona el **país de operación** de la cuenta. Esta información **no se podrá editar más adelante**, y además, los usuarios Comprador y Vendedor deben ser del mismo país.
4. Luego, ingresa una descripción para identificar la cuenta. Por ejemplo: "Vendedor - tienda 1".
5. A continuación, selecciona el tipo de cuenta que deseas crear. Esta puede ser **Vendedor**, **Comprador** o **Integrador**.
6. En caso de que la cuenta de prueba lo solicite, ingresa un **valor ficticio en dinero** que servirá como referencia para probar tus aplicaciones. Este valor aparecerá como saldo en la cuenta de Mercado Pago del usuario de prueba y se podrá utilizar para simular pagos, al igual que las [tarjetas de prueba](/developers/es/guides/additional-content/your-integrations/test-cards).
7. Autoriza el uso de tus datos personales de acuerdo con la [Declaración de Privacidad](https://www.mercadopago[FAKER][URL][DOMAIN]/privacidad) y asegúrate de que tu cuenta utiliza las herramientas de Mercado Pago según los [Términos y Condiciones](/developers/es/docs/resources/legal/terms-and-conditions) marcando la casilla de selección.
8. Haz clic en **Crear cuenta de prueba**.

¡Listo! La cuenta de prueba se ha creado y se mostrará en la tabla con la información a continuación.

![acceder a los usuarios de prueba](/images/snippets/test-cross/test-user-es-list-full.png)

- **Identificación de la cuenta**: Descripción para identificar la cuenta de prueba.
- **Tipo de cuenta**: Clasificador del tipo de cuenta. Puede ser: **Vendedor**, **Comprador** o **Integrador**.
- **País**: Lugar de origen de la cuenta seleccionado en tu registro.
- **User ID**: número de identificación de usuario, que es creado automáticamente.
- **Usuario**: Nombre de usuario de la cuenta de prueba generado automáticamente. Este es el nombre de usuario que se utiliza para iniciar sesión con el test user.
- **Contraseña**: Contraseña de acceso a la cuenta del usuario de prueba generada automáticamente. Para generar una nueva contraseña, haz clic en los 3 puntos verticales al final de la línea de la tabla y selecciona la opción **Generar nueva contraseña**.
- **Código**: Número de 6 dígitos que debes ingresar en caso de que se solicite verificación por e-mail al iniciar sesión con la cuenta de prueba.

> NOTE
>
> Nota
>
> Para editar la **identificación de la cuenta** o **agregar más dinero ficticio** para probar tus aplicaciones, haz clic en los **3 puntos verticales** al final de la línea de la tabla y selecciona la opción **Editar datos**.<br> <br> Puedes generar hasta **15 cuentas** de cuentas de prueba al mismo tiempo y, por ahora, **no es posible eliminarlas**.

## Validar inicio de sesión con cuentas de prueba

Si al iniciar sesión con cuentas de prueba se solicita autenticación por e-mail, ingresa el **código de 6 dígitos** de tu cuenta de prueba que puedes encontrar en **[Tus integraciones](/developers/panel/app) > _Tu aplicación_ > Cuentas de prueba**.

> WARNING
>
> Importante
>
> Para acceder al User ID o el Access Token de una cuenta de prueba, deberás haber creado previamente una aplicación. Para saber cómo hacerlo, accede a la documentación sobre el [Panel del Desarrollador](/developers/es/docs/your-integrations/dashboard). <br> <br> Si tienes dudas sobre cómo obtener el User ID o el Access Token, accede a [Detalles de la aplicación](/developers/es/docs/your-integrations/application-details) o [Credenciales](/developers/es/docs/your-integrations/credentials).

Ten en cuenta que, al realizar este inicio de sesión con una cuenta de prueba, no tendrás acceso a ciertas secciones dentro del Panel del Desarrollador, como a Credenciales de prueba o Calidad de integración. Se trata de secciones que no sólo no son necesarias para este tipo de cuentas, sino que también pueden interferir en el uso adecuado y deseado de los mismos.

# Realiza una compra de prueba

Con tu nombre de usuario y contraseña de teste, sigue los siguientes pasos:

1. Ve a su sitio web y busca el producto/servicio deseado.
2. Realiza el flujo de compra y, al momento del pago, ingresa los datos de una tarjeta de crédito de prueba. Recomendamos utilizar nuestras [tarjetas de crédito nacionales](/developers/es/guides/additional-content/your-integrations/test-cards) en esta etapa.
3. Introduce tus datos de usuario de prueba.
4. Confirma la compra.

¡Listo! Con la prueba completada correctamente, tus productos/servicios ahora pueden estar disponibles para tus clientes.

# Realiza una compra de prueba

Con tu nombre de usuario y contraseña de teste, sigue los siguientes pasos:

1. Ve a su sitio web y busca el producto/servicio deseado.
2. Realiza el flujo de compra y, al momento del pago, ingresa los datos de una tarjeta de crédito de prueba. Recomendamos utilizar nuestras [tarjetas de crédito nacionales](/developers/es/guides/additional-content/your-integrations/test-cards) en esta etapa.
3. Introduce tus datos de usuario de prueba.
4. Confirma la compra.

¡Listo! Con la prueba completada correctamente, tus productos/servicios ahora pueden estar disponibles para tus clientes.

# Gestión de suscripciones

A través de la gestión de suscripciones es posible pausar, cancelar o reactivar una suscripción ya creada, además de realizar otros cambios específicos dentro de su configuración inicial.

En la siguiente tabla encontrarás más información sobre las posibilidades de gestión.

| Tipo                                          | Descripción                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Buscar suscripción                            | Permite buscar suscripciones independientemente de su estado (activa, en pausa, cancelada). Para hacerlo, envía un GET con los parámetros necesarios al endpoint [/preapproval/search](/developers/es/reference/subscriptions/_preapproval_search/get) y ejecuta la solicitud.                                                                                                               |
| Modificar monto                               | Permite modificar el monto de una suscripción existente. Envía el nuevo monto a través de `auto_recurring.transaction_amount` y `auto_recurring.currency_id` en un PUT al endpoint [/preapproval/{id}](/developers/es/reference/subscriptions/_preapproval_id/put).                                                                                                                          |
| Modificar tarjeta del medio de pago principal | Permite modificar la tarjeta asociada a la suscripción existente. Envía un PUT con el nuevo token en atributo `card_token_id` para el endpoint [/preapproval/{id}](/developers/es/reference/subscriptions/_preapproval_id/put).                                                                                                                                                              |
| Modificar medio de pago secundario            | Permite agregar un segundo medio de pago a una suscripción existente. Envía un PUT en el endpoint [/preapproval/{id}](/developers/es/reference/subscriptions/_preapproval_id/put) con los parámetros `card_token_id_secondary` y `payment_method_id_secondary` en caso de que el método secundario sea una tarjeta, y sólo `payment_method_id_secondary` para otros medios de pago.          |
| Cancelar o pausar suscripción                 | Permite cancelar o pausar una suscripción existente. Para cancelarla, envía un PUT con el atributo `status` y el valor `cancelled` al endpoint [/preapproval/{id}](/developers/es/reference/subscriptions/_preapproval_id/put) y ejecuta la solicitud. Para pausarla, envía un PUT con el atributo `status` y el valor `paused` al mismo endpoint y ejecuta la solicitud.                    |
| Reactivar una suscripción                     | Permite reactivar una suscripción en pausa y establecer una fecha límite para su finalización. Para hacerlo, envía un PUT con los parámetros necesarios al endpoint [/preapproval/{id}](/developers/es/reference/subscriptions/_preapproval_id/put) y ejecuta la solicitud.                                                                                                                  |
| Cambiar la fecha de facturación               | Para las suscripciones con una frecuencia de pago mensual, puedes elegir un día fijo del mes para que se produzca la facturación. Para hacerlo, envía un PUT con los parámetros necesarios al endpoint [/preapproval/{id}](/developers/es/reference/subscriptions/_preapproval_id/put) y ejecuta la solicitud.                                                                               |
| Establecer monto proporcional                 | Puedes establecer un monto proporcional para facturar una suscripción en particular. Para hacerlo, envía un PUT con los parámetros necesarios al endpoint [/preapproval/{id}](/developers/es/reference/subscriptions/_preapproval_id/put) y ejecuta la solicitud.                                                                                                                            |
| Ofrecer prueba gratuita                       | Es posible ofrecer un período de prueba gratuito para que los clientes puedan probar el producto y/o servicio antes de comprarlo. Para ello, envía un PUT con los parámetros `free_trial`, `frequency` y `frequency_type` con el número y el tipo (días/meses) al endpoint [/preapproval_plan/{id}](/developers/es/reference/subscriptions/_preapproval_plan_id/put) y ejecuta la solicitud. |

# ¿Por qué se rechaza un pago?

> WARNING
>
> Importante
>
> Esta documentación está destinada a integradores. Si sos comprador y tu pago fue rechazado al usar Mercado Pago, consultá [este artículo](https://www.mercadopago.com.ar/ayuda/por-que-meu-pagamento-com-mercado-credito-pode-ser-recusado_26271) en nuestro Centro de Ayuda para obtener orientación sobre cómo proceder.

La denegación de pagos es una realidad en el mundo de las ventas online y puede ocurrir por varias razones. Un **pago puede ser rechazado por**:

- un error con el medio de pago;
- llenado incorrecto de información por parte del cliente;
- tarjetas sin saldo suficiente;
- carga errónea de datos;
- incumplimiento con algún requisito de seguridad;
- comportamientos sospechosos que indiquen riesgo de fraude;
- problemas en la comunicación entre adquirentes y sub-adquirentes.

Puedes encontrar **toda la información sobre un pago y verificar su estado** a través de la API por medio del método [Obtener pago](/developers/es/reference/payments/_payments_id/get). El campo de `status` indica si el pago fue aprobado o no, mientras que el campo `status_detail` proporciona más detalles, incluidos los motivos del rechazo.

```json
{
    "status": "rejected",
    "status_detail": "cc_rejected_insufficient_amount",
    "id": 47198050,
    "payment_method_id": "master",
    "payment_type_id": "credit_card",
    ...
}
```

> NOTE
>
> Importante
>
> Puedes encontrar más información sobre el detalle del pago en la actividad de la cuenta de [Mercado Pago](https://www.mercadopago[FAKER][URL][DOMAIN]/activities).

## Rechazos por errores en el relleno de datos

Estos rechazos ocurren debido a **errores al momento del checkout**, que pueden suceder por diversas razones: una falla de entendimiento en la pantalla de pago, problemas en la experiencia del comprador, o falta de validación de ciertos campos, así como errores que comete el cliente a la hora de completar sus datos, especialmente datos de tarjetas.

En estos casos, el campo `status_detail` puede devolver:

- `cc_rejected_bad_filled_card_number`
- `cc_rejected_bad_filled_date`
- `cc_rejected_bad_filled_other`
- `cc_rejected_bad_filled_security_code`

## Rechazos del banco emisor

Al ofrecer un **pago con tarjeta de crédito o débito**, el banco emisor puede rechazar el cobro por distintas razones: que la tarjeta se encuentre vencida, que sus fondos o límites sean insuficientes, o que se encuentre bloqueada para compras online.

En estos casos, el campo `status_detail` puede devolver:

- `cc_rejected_call_for_authorize`
- `cc_rejected_card_disabled`
- `cc_rejected_duplicated_payment`
- `cc_rejected_insufficient_amount`
- `cc_rejected_invalid_installments`
- `cc_rejected_max_attempts`

## Rechazos para prevenir fraude

Monitoreamos en tiempo real las transacciones, buscando **reconocer características y patrones sospechosos** que apunten a un intento de fraude. Esto es hecho tanto por los algoritmos de Mercado Pago como por los bancos, todo para evitar al máximo los contracargos (_chargebacks_).

Cuando los sistemas de prevención detectan un pago sospechoso, la respuesta de la API puede devolver en el `status_detail`:

- `cc_rejected_blacklist`
- `cc_rejected_high_risk`
- `cc_rejected_other_reason`

> WARNING
>
> Atención
>
> La respuesta `cc_rejected_other_reason` es un status que proviene del banco emisor y, si bien no explicita el motivo de rechazo, se trata de una estimación de riesgo de fraude. Igualmente, hay otros motivos por los cuales este status puede ser devuelto. En caso de duda, es recomendable elegir otro medio de pago o ponerse en contacto con la entidad bancaria.

```json
 {
    "status": "rejected",
    "status_detail": "cc_rejected_high_risk",
    "id": 47198050,
    "payment_method_id": "master",
    "payment_type_id": "credit_card",
    ...
}
```

> WARNING
>
> Atención
>
> En algunos casos, la respuesta `cc_rejected_high_risk` puede aparecer cuando se intentan realizar dos pagos consecutivos con los mismos ítems o con parámetros muy similares (como `payer` e `items` idénticos en ambos pagos realizados). Esto puede hacer que el motor antifraude lo interprete como un intento duplicado y lo rechace por precaución, bloqueando todos los pagos posteriores temporalmente.
>
> Se recomienda implementar controles para evitar reintentos inmediatos con los mismos datos.

# Recomendaciones para mejorar la aprobación de pagos

Para **evitar que un pago legítimo sea rechazado** por no cumplir con las validaciones de seguridad, es necesario incluir el máximo de información posible a la hora de realizar la operación, así como que tu checkout cuente con su interfaz optimizada.

Puedes ver en detalle nuestras **recomendaciones para mejorar tu aprobación** a continuación.

## Obtén y envía el Device ID

El **Device ID** es una información importante para lograr una mejor seguridad y, en consecuencia, una mejor tasa de aprobación de pagos. Representa un **identificador único para el dispositivo de cada comprador** en el momento de la compra.

Si un comprador frecuente hace una compra desde un dispositivo diferente al habitual, esto podría representar un comportamiento atípico. Aunque puede no ser necesariamente un fraude, el Device ID nos ayuda a refinar la evaluación y evitar el rechazo de pagos legítimos.

> WARNING
>
> Atención
>
> Si estás utilizando el [JS SDK de Mercado Pago](/developers/es/docs/sdks-library/client-side/mp-js-v2), **no** será necesario agregar el código de seguridad, ya que la información relativa al Device ID será obtenida por defecto.

Puedes **agregar el código de seguridad de Mercado Pago** a tu sitio reemplazando el valor de `view` con el nombre de la sección de tu web en la que deseas agregarlo. Si bien lo más importante es hacerlo en la **página del checkout**, también puedes hacerlo en **otras páginas**, tales como home, search o ítem, ya que ayuda a enriquecer la información recolectada.

```html
<script src="https://www.mercadopago.com/v2/security.js" view="home"></script>
```

> NOTE
>
> Importante
>
> En caso de no tener un valor disponible para la sección, puedes dejarlo vacío.

## Uso del Device ID en la web

Para usar el Device ID en la web y prevenir posibles compras fraudulentas, debes seguir los siguientes pasos:

### 1. Agrega nuestro código de seguridad

Para implementar la generación del Device ID en tu sitio, agrega el siguiente código a tu página de Checkout:

```html
<script src="https://www.mercadopago.com/v2/security.js" view="checkout"></script>
```

### 2. Obtén el device ID

Una vez que hayas agregado el código de seguridad de Mercado Pago a tu sitio, automáticamente se crea una variable JavaScript global con el nombre `MP_DEVICE_SESSION_ID`, cuyo valor es el ID del dispositivo.

Si prefieres asignarlo a otra variable, indica el nombre agregando el atributo `output` al script de seguridad, como en el siguiente ejemplo:

```html
<script src="https://www.mercadopago.com/v2/security.js" view="checkout" output="deviceId"></script>
```

También puedes **crear tu propia variable** agregando una etiqueta HTML a tu sitio con el identificador `id="deviceID"`, como en el siguiente ejemplo:

```html
<input type="hidden" id="deviceId" />
```

### 3. Uso del device ID

Una vez que tengas el valor del Device ID, debes **enviarlo a nuestros servidores** al crear un pago. Para hacer esto, agrega el siguiente **encabezado (_header_)** a la solicitud:

```html
X-meli-session-id: device_id
```

> WARNING
>
> Atención
>
> Recuerda reemplazar `device_id` con el nombre de la variable que contiene su valor de ID del dispositivo.

## Implementa el Device ID en tu aplicación móvil nativa

Si tienes una aplicación nativa, puedes capturar la información del dispositivo con nuestro SDK y enviarla al momento de crear el token. Sigue estos pasos:

### 1. Agrega la dependencia

[[[

```ios
===
Agrega el siguiente código en el archivo **Podfile**.
===
use_frameworks!
pod ‘MercadoPagoDevicesSDK’
```

```android
===
Necesitas agregar el repositorio y la dependencia en el archivo **build.gradle**.
===
repositories {
    maven {
        url "https://artifacts.mercadolibre.com/repository/android-releases"
    }
}
dependencies {
   implementation 'com.mercadolibre.android.device:sdk:3.0.5'
}
```

]]]

### 2. Inicializa el módulo

[[[

```swift
===
Te recomendamos iniciarlo en el evento didFinishLaunchingWithOptions del AppDelegate.
===
import MercadoPagoDevicesSDK
...
func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        ...
        MercadoPagoDevicesSDK.shared.execute()
        ...
}
```

```objective-c
===
Te recomendamos iniciarlo en el evento didFinishLaunchingWithOptions del AppDelegate.
===
@import ‘MercadoPagoDevicesSDK’;
...
- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
    ...
    [[MercadoPagoDevicesSDK shared] execute];
    ...
}
```

```java
===
Te recomendamos iniciarlo en la clase MainApplication.
===
import com.mercadolibre.android.device.sdk.DeviceSDK;
DeviceSDK.getInstance().execute(this);
```

]]]

### 3. Captura la información

Ejecuta alguna de estas funciones para obtener la información en el formato que prefieras.

[[[

```swift
MercadoPagoDevicesSDK.shared.getInfo() // devuelve un objeto Device que es Codable
MercadoPagoDevicesSDK.shared.getInfoAsJson() // devuelve un objeto Data de la librería de JSON
MercadoPagoDevicesSDK.shared.getInfoAsJsonString() // devuelve el json en formato de String
MercadoPagoDevicesSDK.shared.getInfoAsDictionary() // devuelve un Dictionary<String,Any>
```

```objective-c
[[[MercadoPagoDevicesSDK] shared] getInfoAsJson] // devuelve un objeto Data de la librería JSON
[[[MercadoPagoDevicesSDK] shared] getInfoAsJsonString] // devuelve el json en formato de String
[[[MercadoPagoDevicesSDK] shared] getInfoAsDictionary] // devuelve un Dictionary<String,Any>
```

```java
Device device = DeviceSDK.getInstance().getInfo() // devuelve un objeto Device, serializable
Map deviceMap = DeviceSDK.getInstance().getInfoAsMap()  // devuelve un Map<String, Object>
String jsonString = DeviceSDK.getInstance().getInfoAsJsonString() // devuelve un String de tipo Json
```

]]]

### 4. Envía la información

Por último, envía la información en el campo `device` al crear el `card_token`.

```
{
	...,
	 "device":{
	  "fingerprint":{
	     "os":"iOS",
	     "system_version":"8.3",
	     "ram":18446744071562067968,
	     "disk_space":498876809216,
	     "model":"MacBookPro9,2",
	     "free_disk_space":328918237184,
	     "vendor_ids":[
	        {
	           "name":"vendor_id",
	           "value":"C2508642-79CF-44E4-A205-284A4F4DE04C"
	        },
	        {
	           "name":"uuid",
	           "value":"AB28738B-8DC2-4EC2-B514-3ACF330482B6"
	        }
	     ],
	     "vendor_specific_attributes":{
	        "feature_flash":false,
	        "can_make_phone_calls":false,
	        "can_send_sms":false,
	        "video_camera_available":true,
	        "cpu_count":4,
	        "simulator":true,
	        "device_languaje":"en",
	        "device_idiom":"Phone",
	        "platform":"x86_64",
	        "device_name":"iPhone Simulator",
	        "device_family":4,
	        "retina_display_capable":true,
	        "feature_camera":false,
	        "device_model":"iPhone Simulator",
	        "feature_front_camera":false
	     },
	     "resolution":"375x667"
	  }
}
```

## Detalla toda la información sobre el pago

Para optimizar la validación de la seguridad de los pagos y mejorar sus aprobaciones, es valioso enviar la mayor cantidad posible de **datos del comprador y del ítem**.
Puedes ver todos los atributos disponibles al crear un pago usando el método [Crear pago](/developers/es/reference/payments/_payments/post). Presta especial atención a los atributos del nodo `adicional_inf`, particularmente a:

- Datos del comprador,
- Datos del producto,
- Datos del envío.

Existen también **campos extra** que pueden ser enviados dependiendo del **ramo de actividades o industria** de tu tienda. Puedes encontrar más detalles sobre cada ramo y los datos del comprador y del envío que recomendamos incluir en cada uno de ellos [aquí](/developers/es/docs/checkout-api/additional-content/industry-data).

## Mejora la experiencia del usuario

A menudo, el comprador puede cometer un error al completar sus datos en el checkout, así que vale la pena revisar cada paso, posibles interacciones, e incluso el diseño, para comprobar que todo esté tan claro como debería ser.

En caso de que optes por **crear tu front-end desde cero**, puedes encontrar consejos para hacerlo de forma eficiente [aquí](/developers/es/docs/checkout-api/best-practices/ux-best-practices/ux-for-checkouts/introduction).
Si un pago resultara rechazado, es importante también que expliques a tus clientes el motivo y qué medidas pueden tomar para solucionarlo. De esta forma, tendrán toda la información que necesitan para pagar sin problemas. Puedes encontrar **recomendaciones de mensajes para los principales motivos de rechazo** [aquí](/developers/es/docs/checkout-api/response-handling/collection-results).
Si, en cambio, quieres garantizar una interfaz optimizada, puedes utilizar los **componentes visuales de [Checkout Bricks](/developers/es/docs/checkout-bricks/landing)**, así como aprovechar el componente visual ya listo con los mejores mensajes del **[Status Screen Brick](/developers/es/docs/checkout-bricks/status-screen-brick/introduction)**.

> WARNING
>
> Importante
>
> Recomendamos evaluar la [calidad de tu integración](/developers/es/docs/checkout-api/additional-content/integration-quality) antes de salir a producción para que puedas validar si estás cumpliendo con los estándares de calidad y seguridad de Mercado Pago que pueden mejorar tu tasa de aprobación de pagos.
