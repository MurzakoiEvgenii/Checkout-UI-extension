# Checkout Branding App

A Shopify embedded admin app (Remix + Polaris) for applying preset color schemes, configuring header position, and uploading a logo to a store's checkout via the Admin GraphQL API (`checkoutBrandingUpsert`).

## Prerequisites

- **Node.js** `>=20.19 <22` or `>=22.12`
- **Shopify CLI**
  ```bash
  npm install -g @shopify/cli@latest
  ```
- **ngrok** (for a stable public HTTPS tunnel)
  ```bash
  brew install ngrok          # macOS
  # or: https://ngrok.com/download
  ngrok config add-authtoken <YOUR_NGROK_AUTHTOKEN>
  ```
- **Shopify Partner account** with at least one development store

## Development store requirements

> **Important:** the `checkoutBrandingUpsert` mutation requires a store on **Shopify Plus** or a **Plus development store**. A Basic dev store will always return `Access denied`.

When creating a new store in **Partners → Stores → Create store**:

1. Choose **Dev** (Testing, dev, or staging environments)
2. **Shopify plan**: select **Plus** (test plan features for free)
3. (Optional) Toggle test data / feature previews — they don't affect checkout branding

If the existing store is on Basic, either change its plan in Partners or create a new one with Plus selected.

## App access scopes

The app is configured (in `shopify.app.toml`) with the following access scopes — do not remove them:

- `read_checkout_branding_settings`, `write_checkout_branding_settings` — required by `checkoutBrandingUpsert`
- `read_files`, `write_files` — required by `stagedUploadsCreate` / `fileCreate` for logo uploads
- `write_products` — kept from the template

After changing scopes in `shopify.app.toml`, restart `shopify app dev` and confirm the prompt to update remote config; Shopify CLI will auto-grant scopes on development stores.

## Running locally

The app expects two terminals: one for the ngrok tunnel, another for the Shopify dev server.

### 1. Start the ngrok tunnel

```bash
ngrok http 3000
```

ngrok will print a public HTTPS URL such as:

```
Forwarding   https://body-juicy-nanometer.ngrok-free.dev -> http://localhost:3000
```

Copy that URL — you'll pass it to the Shopify CLI.

> If you have a reserved/static ngrok domain, you can use it instead:
> ```bash
> ngrok http --domain=body-juicy-nanometer.ngrok-free.dev 3000
> ```
> This keeps the URL stable between restarts, so Shopify doesn't have to re-register URLs every time.

### 2. Start the Shopify app dev server

In a second terminal:

```bash
shopify app dev --tunnel-url https://<your-ngrok-domain>:3000
```

For example:

```bash
shopify app dev --tunnel-url https://body-juicy-nanometer.ngrok-free.dev:3000
```

The first time you run this CLI will:

- Link the local project to your `newBrandCheckout` app
- Pick the dev store (`brandcheckout.myshopify.com` or whichever you select)
- Update the app URLs (callbacks, app URL) to your ngrok domain
- Auto-grant the access scopes listed in `shopify.app.toml`

When you see `✅ Ready, watching for changes in your app`, press:

- `p` — open the app preview in the Shopify admin
- `g` — open GraphiQL against the Admin API (useful for debugging mutations and queries)
- `q` — quit

### Resetting the configuration

If you need to relink the app or change the dev store:

```bash
shopify app dev --reset --tunnel-url https://<your-ngrok-domain>:3000
```

## Using the app

1. Open the app from `Apps` in the Shopify admin (or via `p` in the CLI terminal).
2. Navigate to **Checkout Branding** in the side menu.
3. In the right column, pick one of the four preset color schemes (`Classic Clean`, `Dark Luxe`, `Warm Earth`, `Bold Neon`).
4. In the left column, configure:
   - **Checkout profile** — the profile to apply changes to (usually the published one).
   - **Header position** — `Top (default)` (logo on top, full-width) or `Left, above form` (logo on the left).
   - **Logo image** — PNG/JPG/GIF/WebP (SVG not supported by Shopify checkout branding).
   - **Remove current logo from checkout** — explicitly clears the existing logo so the store name shows instead.
5. Click **Apply scheme**.

Once a success banner appears, open **Shopify Admin → Settings → Checkout → Customize** to see the result on the actual checkout.

## Production build

```bash
npm run build
npm run start
```

For deployment to Shopify infrastructure (`fly`, `vercel`, `render`, etc.), follow the standard Remix deployment guides plus `shopify app deploy` to push the app config to Partners.

## Useful commands

```bash
npm run dev                              # shorthand for `shopify app dev`
shopify app dev --reset                  # reset app/store linkage
shopify app deploy                       # push shopify.app.toml + extensions to Partners
shopify app env pull                     # pull env vars (API key/secret) into .env
npm run lint                             # run eslint
npx prisma migrate dev                   # apply local DB migrations
```

## Troubleshooting

- **`Access denied for checkoutBrandingUpsert`** — store is not on a Plus/dev-Plus plan, or app was installed before scopes were updated. See [Development store requirements](#development-store-requirements).
- **`Access denied for stagedUploadsCreate`** — missing `write_files`/`read_files` scopes. Check `shopify.app.toml` and restart `shopify app dev` so CLI auto-grants them.
- **`Invalid corner radius. The value must be greater than 0`** — handled by the app: schemes with sharp corners send `customizations.global.cornerRadius: NONE` instead of zero pixel values.
- **Logo not removed when "Remove" is clicked** — clicking the Remove button on the preview only clears the local file input. Use the **Remove current logo from checkout** checkbox to send `mediaImageId: null` to Shopify.
- **ngrok keeps changing URL** — use a [reserved domain](https://dashboard.ngrok.com/domains) (free tier supports one static domain).

## Stack

- Remix (Vite) + React 18
- `@shopify/shopify-app-remix` (session, auth, admin GraphQL client)
- `@shopify/polaris` for UI components
- `@shopify/app-bridge-react` for the admin embed
- Prisma + SQLite for session storage (dev)
- Shopify Admin GraphQL API for branding (`checkoutBrandingUpsert`, `stagedUploadsCreate`, `fileCreate`)

## FAQ — про Shopify Checkout Branding API

### Как вообще работает Checkout Branding API?

Это часть Admin GraphQL API. На практике всё крутится вокруг двух операций:

- `checkoutProfiles` — query, возвращает список всех профилей чекаута магазина.
- `checkoutBrandingUpsert` — mutation, принимает `checkoutProfileId` и большой объект `CheckoutBrandingInput`, в котором описаны все визуальные настройки.

Внутри `CheckoutBrandingInput` две большие ветки: `designSystem` (тема/токены) и `customizations` (per-component настройки). Мутация ведёт себя как **upsert** — поля, которые ты не передал, остаются как были. Если хочется сбросить конкретное поле, нужно явно передать `null` в этом поле.

### В чём разница между `designSystem` и `customizations`?

Я для себя думаю об этом так:

- **`designSystem`** — это **дизайн-токены**. Тут лежат «общие переменные»: 3 цветовые схемы (`scheme1`, `scheme2`, `scheme3`), пиксельные значения углов (`cornerRadius.base / small / large`), типографика, размеры. Эти токены сами по себе ничего не красят — они только описывают «палитру», из которой потом черпают конкретные компоненты.
- **`customizations`** — это **применение токенов к конкретным частям UI**: `header`, `main`, `orderSummary`, `footer`, `primaryButton`, `secondaryButton`, `control`, `checkbox` и т.д. Тут ты, например, говоришь: «header использует цветовую схему `COLOR_SCHEME3`, выравнивание центральное, позиция сверху», или «у primaryButton corner radius = `NONE`».

Простой пример: ты определяешь в `designSystem.cornerRadius.base = 6`, а потом в `customizations.primaryButton.cornerRadius = "BASE"`. Кнопка получит 6 пикселей. Если завтра захочешь во всём чекауте углы по 10 пикселей — просто меняешь токен в `designSystem`, а все компоненты, которые ссылаются на `BASE`, автоматически обновятся.

### Как менять цвета, шрифты и кнопки?

- **Цвета** — внутри `designSystem.colors.schemes.scheme1/2/3`. Каждая схема — это набор ролей (`base`, `primaryButton`, `secondaryButton`, `control`) с парами `{ background, text }`. По-умолчанию Shopify применяет `scheme1` к main-области, `scheme2` к order summary и `scheme3` к header — но это переопределяется в `customizations.<section>.colorScheme`.
- **Шрифты** — `designSystem.typography.primary / secondary` принимают `ShopifyFontGroup` (одна из встроенных групп) или `CustomFontGroup` с ссылкой на загруженный через Files API шрифт. Дальше в `customizations.<component>.typography.size / weight / kerning` можно тонко настроить отдельные элементы.
- **Кнопки** — `customizations.primaryButton` и `customizations.secondaryButton`. Тут `background` (`SOLID` / `NONE` / `TRANSPARENT`), `border` (`FULL` / `BLOCK_END` / `NONE`), `cornerRadius` (enum: `NONE | SMALL | BASE | LARGE`), `blockPadding` / `inlinePadding`, `typography`. Цвета кнопок берутся из роли `primaryButton` / `secondaryButton` той цветовой схемы, которая применена к секции.

### Что такое `checkoutProfiles` и как они влияют на кастомизацию?

Checkout profile — это контейнер со всеми настройками чекаута: branding, поведение, какие extensions включены. У каждого магазина их может быть несколько, и ровно один из них всегда `isPublished: true` — это тот, который видят покупатели. Остальные — драфты, по сути «ветки» дизайна.

Когда ты вызываешь `checkoutBrandingUpsert`, ты обязан указать `checkoutProfileId` — все изменения уходят именно в этот профиль и больше никуда. Это очень удобно для тестирования: можно нарисовать новый дизайн на draft-профиле, проверить его в Shopify admin, и только потом опубликовать.

### Как проверить изменения перед публикацией?

Самый простой способ — в **Shopify Admin → Settings → Checkout → Customize**. Там есть встроенный редактор с предварительным просмотром и переключателем профилей сверху. Применяешь свои изменения через API к draft-профилю, открываешь его в редакторе — видишь, как реально будет выглядеть чекаут (с настоящими товарами магазина).

Второй вариант — если у драфт-профиля есть `previewUrl`, можно открыть его прямо в браузере и оформить тестовый заказ.

### Можно ли применять разные стили к разным страницам чекаута?

Не совсем «к разным страницам» в смысле «information → shipping → payment». Внутри одного чекаута все шаги используют общий branding из активного профиля. Зато:

- Можно настраивать **разные секции внутри страницы** независимо — `header`, `main`, `orderSummary`, `footer`, а также отдельные группы вроде `main.section` (контейнеры внутри основной области) и `orderSummary.section`.
- Можно настраивать **отдельные компоненты** — `primaryButton`, `secondaryButton`, `control`, `select`, `checkbox`, `textField` и др.
- Если нужны принципиально разные стили (например, под B2B vs обычный чекаут или под разные Markets) — это делается через **разные checkout profiles**: каждый Market / контекст может использовать свой профиль с собственным дизайном.

### Какие ограничения у Checkout Branding API?

Из того, что мы прошли в этом проекте:

- **План магазина**: только Shopify Plus или Plus development store. На Basic dev store API всегда отдаёт `Access denied`.
- **User permission**: пользователь, который установил приложение, должен иметь право `preferences` (для owner-аккаунта это автоматически).
- **Access scopes**: `read_checkout_branding_settings`, `write_checkout_branding_settings`, плюс `write_files` / `read_files` для загрузки логотипа и шрифтов.
- **Лого не может быть SVG** — только PNG/JPG/GIF/WebP.
- **`designSystem.cornerRadius` принимает только положительные значения** (`> 0`). Чтобы получить «острые углы 0px», используется enum `NONE` в `customizations.global.cornerRadius` или в каждом компоненте отдельно.
- **`customizations.global.cornerRadius` принимает только `NONE`** — это глобальный override-переключатель, а не полноценный enum.
- **`checkoutBrandingUpsert` помечен как deprecated** — Shopify рекомендует переходить на `checkoutAndAccountsConfigurationUpdate`. Старая мутация пока работает, но для новых проектов лучше брать новую.
- **Файлы (логотип, шрифты) грузятся через staged upload** — нельзя просто послать base64. Процесс: `stagedUploadsCreate` → `PUT` на staging URL → `fileCreate` → дождаться `fileStatus: READY`.

### Как сбросить настройки к стандартным?

Передать `null` в `checkoutBrandingInput`:

```graphql
mutation ResetBranding($id: ID!) {
  checkoutBrandingUpsert(checkoutProfileId: $id, checkoutBrandingInput: null) {
    checkoutBranding { designSystem { colors { schemes { scheme1 { base { background } } } } } }
    userErrors { field message }
  }
}
```

Это снесёт **всё**, и чекаут вернётся к стандартному виду Shopify. Если хочется снести что-то одно (например, только логотип), нужно передать `null` именно в этом поле — так в этом приложении и сделана кнопка «Remove current logo from checkout»: она отправляет `customizations.header.logo.image.mediaImageId: null` вместо целого reset.

### Как тестировать чекаут, не задевая продакшен?

Несколько вариантов, от простого к более сложному:

1. **Plus development store** — самый чистый путь. Создаёшь отдельный dev-магазин с Plus планом (см. секцию выше), катаешь все эксперименты на нём, в продакшен ничего не уходит.
2. **Draft checkout profile** в реальном магазине — если приходится работать с боевым store, не трогай опубликованный профиль. Создай новый профиль (через Admin UI или соответствующую мутацию), применяй к нему изменения, открывай предпросмотр, и только когда всё устраивает — публикуй.
3. **Превью через draft profile** — у каждого черновика есть свой `previewUrl`, по которому можно открыть «настоящий» чекаут и пройти его, не публикуя. Идеально для UAT.
4. **Test orders** — Shopify даёт тестовый шлюз `Bogus Gateway` для оплат, его можно включить в Settings → Payments → "Manage" → Manual / Test. С ним можно реально оформлять заказы в dev store и сразу смотреть, как настоящий чекаут реагирует на твои изменения.
