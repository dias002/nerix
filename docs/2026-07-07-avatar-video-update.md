# nomduchat avatar video update

Дата: 2026-07-07

## Что изменилось

- добавлен рабочий AI-видео flow с лицом пользователя через HeyGen image-to-video;
- `AvatarStudio` теперь умеет принимать портретное фото, текст сценария, consent и запускать generation job;
- backend поддерживает `avatar_video` как отдельную modality;
- фото передается как temporary reference image asset, а не сохраняется в job metadata;
- старый HeyGen video-agent сценарий оставлен как fallback;
- добавлены тесты на routing, provider flow и image-to-video создание;
- проверка `api:build`, `api:test`, `web:build` прошла успешно.

## Как это использовать

1. Открыть `/workspace/avatar`.
2. Загрузить портретное фото.
3. Ввести текст, который должен произнести аватар.
4. Подтвердить consent.
5. Нажать `Создать видео`.

## Нужные env vars

- `HEYGEN_API_KEY`
- `HEYGEN_VOICE_ID`
- `HEYGEN_AVATAR_ID` нужен только для старого video-agent fallback

## Ключевые файлы

- `apps/api/src/modules/generation/routes.ts`
- `apps/api/src/modules/generation/generation.service.ts`
- `apps/api/src/modules/generation/media-provider.ts`
- `apps/web/src/app/pages/AvatarStudio.tsx`
- `apps/web/src/app/api-client/generation.ts`
- `apps/api/test/services.test.ts`
