# nomduchat iOS attachment review fix

Дата: 2026-07-07

## Что исправлено

- добавлен attachment flow в Flutter-клиент `nomduchat` для iOS и Android;
- в composer появился `paperclip`-кнопка и список выбранных файлов;
- отправка теперь уходит в backend `/chat/messages` вместе с `attachments`;
- текстовые файлы читаются на клиенте и передаются с `content`, non-text отправляются только как metadata;
- поддержан сценарий отправки файла без отдельного текста через дефолтный prompt;
- iOS picker реализован нативно через `UIDocumentPickerViewController`;
- Android picker реализован нативно через `ACTION_OPEN_DOCUMENT`.

## Что проверено

- `flutter test test/nomduchat_api_test.dart test/widget_test.dart` прошел;
- `flutter build ios --simulator --no-codesign` прошел;
- `flutter build apk --debug` дошел до упаковки и упал только из-за нехватки места на диске, не из-за кода.

## Что важно помнить для App Review

- приложение отправляет в AI только текст сообщения, attachments metadata и text-snippet для текстовых файлов;
- password, card data, secrets и другие чувствительные данные в AI не отправляются;
- iPad attachment bug закрыт в коде, потому что picker и payload теперь есть в самом клиенте, а не только в backend.

## Обновление 2026-07-09

- найден реальный iPad-specific root cause: native picker был привязан через `AppDelegate`/`window`, тогда как приложение работает через scene lifecycle и implicit Flutter engine;
- iOS attachment picker переписан как нормальный Flutter plugin с регистрацией через `FlutterImplicitEngineDelegate`;
- picker теперь ищет активный `UIWindowScene`, берет верхний `UIViewController` и открывает `UIDocumentPickerViewController` из текущей сцены;
- чтение файлов на iOS идет через security-scoped access, чтобы выбранные документы реально читались после выбора;
- добавлены отдельные тесты на `MethodChannel` attachment flow и widget-тесты на attach/send/oversize reject;
- `flutter test test/nomduchat_api_test.dart test/chat_attachments_test.dart test/widget_test.dart` прошел, 18/18;
- `flutter analyze` прошел без замечаний;
- `flutter build ios --simulator` прошел;
- `flutter build ipa --release` собрал signed IPA `build/ios/ipa/nomduchat.ipa`;
- версия для следующей отправки в App Review поднята до `1.0.0+4`.
