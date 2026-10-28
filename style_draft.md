## 내 코드 스타일 (Flutter)
아래 규칙으로 작성한다. 이 스타일을 기본으로 따른다.

- `build`는 `Scaffold`만 두고, 화면 조각은 `Widget back() =>`, `Widget content() =>`처럼 메서드로 뺀다.
- 조건은 삼항과 `if`로 처리하고, 위젯은 `=>` 한 줄 반환을 쓴다.
- 상태는 `StatefulWidget` + `setState`, 공유 값은 `static ValueNotifier` + `ValueListenableBuilder`로 쓴다.
- 이름은 짧은 영어 camelCase (`ontap`, `pageIndex`, `showMoon`).
- 색, 크기, 문구는 하드코딩하고 색은 공통 상수 파일에서 가져온다.
- Dart 점 단축 표기를 쓴다. (`.center`, `.only(left: 15)`, `.circular(50)`)
- 애니메이션은 `bool showX` + `Future.delayed` 순서 + `AnimatedOpacity/AnimatedPositioned`로 만든다.
- 대회에서는 파일을 최소로 나눈다. (`main.dart` + 화면별 파일 + `util.dart` 정도)
- **외부 패키지 금지**: `flutter_svg`는 쓰지 않는다. 이미지는 `Image.asset`을 쓴다.

## 내 코드 스타일 (Flutter 구조: controller / model / util)

- 폴더는 `controller/`, `model/`, `page/`(하위 `menu/`, `widget/`), `util/util.dart`로 나눈다.
- 화면 1개 = 파일 1개, API 응답 1종 = 모델 파일 1개, 기능 1종 = 컨트롤러 파일 1개.
- 파일명은 `소문자_스네이크.dart`, 클래스는 `XxxPage`, `XxxController`, `XxxModel`.
- 컨트롤러는 인스턴스 없이 `static` 필드와 `static` 메서드만 쓴다. (`AuthController.token`, `ProductController.getAlbums()`)
- 서버 통신은 `package:http`를 `as http`로 불러 쓴다. 주소는 `util.dart`의 `baseUrl` 하나만 쓴다. (대회에서 주소가 매일 바뀜)
- 헤더는 `util.dart`의 `header`(로그인 전), `header2(token)`(Bearer 토큰)을 쓴다.
- 응답 처리: `statusCode == 200`이면 `jsonDecode(response.body)['data']`를 모델로 바꿔 반환하고, 아니면 `null`을 반환한다.
- 오류 메시지는 응답의 `errors[].message`를 `List<String>`(또는 필드별 `Map<String, String>`)으로 모아 반환하고, 화면에서 보여준다.
- 모델은 `final` 필드 + `required` 생성자 + `factory XxxModel.fromJson(Map<String, dynamic> json) => ...` 형태로 쓴다. 필드 옆에 응답 예시 값을 `// "Blonde",`처럼 주석으로 단다.
- 화면에서 쓰는 값(`token`, 좋아요 목록, 알림 개수)은 컨트롤러의 `static ValueNotifier`에 두고 `ValueListenableBuilder`로 그린다.
- `util.dart`에는 서버 주소, 헤더, 색 상수, 화면 크기 함수(`sizew`, `sizeh`), `toast`, 금액 포맷, 서버값↔화면값 변환용 `Map` 상수를 모은다.
- 오타를 따라 쓰지 않는다. (샘플의 `fromJsom`, `qeure`는 `fromJson`, `query`로 쓴다)
