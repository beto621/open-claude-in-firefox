# Open Claude in Firefox — Integration Test Prompt

Copy and paste everything below the line into a new Claude Code session that has the `open-claude-in-firefox` MCP configured.

---

You are running an integration test for a Firefox browser automation extension. Your job is to execute every step below and use the specific MCP tool listed for each step. Do NOT skip any tool — every single one must be called at least once.

Execute these steps in order:

## Tab Management
1. Call `tabs_context_mcp` with `createIfEmpty: true` to get current tabs.
2. Call `tabs_create_mcp` to create a new tab. Record its tab ID as TAB_1.
3. Call `tabs_create_mcp` again to create a second tab. Record its tab ID as TAB_2.

## Navigation + Window
4. Call `navigate` to go to `https://www.reddit.com` in TAB_1. (This domain is blocked in Anthropic's official Chrome extension — if this works, the unrestricted Firefox extension is functioning.)
5. Call `resize_window` to set the window to 1280x800 using TAB_1.

## Screenshots + Reading
6. Call `computer` with action `screenshot` on TAB_1.
7. Call `read_page` on TAB_1 with filter `"all"` to get the accessibility tree.
8. Call `get_page_text` on TAB_1 to extract the text content.

## Finding + Form Input
9. Call `find` with query `"search"` on TAB_1 to locate the search input.
10. Call `form_input` on TAB_1 using the ref from step 9 to set the search value to `"MCP server"`.

## Mouse + Keyboard Actions
11. Call `computer` with action `left_click` on TAB_1 at the coordinates of the search input (from step 9).
12. Call `computer` with action `key` on TAB_1 with text `"Enter"` to submit the search.
13. Call `computer` with action `wait` on TAB_1 with duration `3` to wait for results.
14. Call `computer` with action `scroll` on TAB_1 with scroll_direction `"down"` and scroll_amount `3` at coordinates `[640, 400]`.
15. Call `computer` with action `hover` on TAB_1 at coordinates `[640, 300]`.
16. Call `computer` with action `double_click` on TAB_1 at coordinates `[640, 300]`.
17. Call `computer` with action `triple_click` on TAB_1 at coordinates `[640, 300]`.
18. Call `computer` with action `right_click` on TAB_1 at coordinates `[640, 300]`.
19. Call `computer` with action `type` on TAB_1 with text `"integration test"`.
20. Call `computer` with action `scroll_to` on TAB_1 at coordinates `[0, 0]`.

## JavaScript + Debug
21. Call `javascript_tool` on TAB_1 with action `"javascript_exec"` and text `"document.querySelectorAll('a').length"`.
22. Call `read_console_messages` on TAB_1 with pattern `".*"`.
23. Call `read_network_requests` on TAB_1.

## Second Tab
24. Call `navigate` to go to `https://news.ycombinator.com` in TAB_2.
25. Call `computer` with action `screenshot` on TAB_2.

## Drag
26. Call `computer` with action `left_click_drag` on TAB_1 with start_coordinate `[100, 300]` and coordinate `[400, 300]`.

## Zoom
27. Call `computer` with action `zoom` on TAB_1 with region `[0, 0, 640, 400]`.

## Stub Tools (call them — they should return gracefully)
28. Call `gif_creator` with action `"start_recording"` on TAB_1.
29. Call `shortcuts_list` on TAB_1.
30. Call `shortcuts_execute` on TAB_1 with command `"test"`.
31. Call `switch_browser`.

## Plan + Upload
32. Call `update_plan` with domains `["reddit.com", "news.ycombinator.com"]` and approach `["Testing browser automation", "Validating all tools", "Checking parity with Claude in Chrome"]`.
33. Call `upload_image` on TAB_1 with the imageId from your first screenshot (step 6), using ref from step 9. (Expected: "not supported" response — this is correct behaviour on Firefox.)

## Validation

Now produce a final report. List every one of the 18 tools below and whether you successfully called it during this test. Use this exact format:

```
INTEGRATION TEST RESULTS
========================
1.  tabs_context_mcp        : [PASS/FAIL] — step(s) used
2.  tabs_create_mcp          : [PASS/FAIL] — step(s) used
3.  navigate                 : [PASS/FAIL] — step(s) used
4.  computer                 : [PASS/FAIL] — step(s) used (list actions exercised)
5.  find                     : [PASS/FAIL] — step(s) used
6.  form_input               : [PASS/FAIL] — step(s) used
7.  get_page_text            : [PASS/FAIL] — step(s) used
8.  gif_creator              : [PASS/FAIL] — step(s) used
9.  javascript_tool          : [PASS/FAIL] — step(s) used
10. read_console_messages    : [PASS/FAIL] — step(s) used
11. read_network_requests    : [PASS/FAIL] — step(s) used
12. read_page                : [PASS/FAIL] — step(s) used
13. resize_window            : [PASS/FAIL] — step(s) used
14. shortcuts_list           : [PASS/FAIL] — step(s) used
15. shortcuts_execute        : [PASS/FAIL] — step(s) used
16. switch_browser           : [PASS/FAIL] — step(s) used
17. update_plan              : [PASS/FAIL] — step(s) used
18. upload_image             : [PASS/FAIL] — step(s) used

Computer actions exercised:
- screenshot: [PASS/FAIL]
- left_click: [PASS/FAIL]
- right_click: [PASS/FAIL]
- double_click: [PASS/FAIL]
- triple_click: [PASS/FAIL]
- hover: [PASS/FAIL]
- type: [PASS/FAIL]
- key: [PASS/FAIL]
- scroll: [PASS/FAIL]
- scroll_to: [PASS/FAIL]
- wait: [PASS/FAIL]
- left_click_drag: [PASS/FAIL]
- zoom: [PASS/FAIL]

OVERALL: [PASS if all 18 tools called / FAIL if any missed]
```

Mark a tool as PASS only if you actually called it and received a response (even if the response was "not implemented" for stub tools). Mark it as FAIL if you skipped it or encountered an error that prevented the call.

If OVERALL is FAIL, list which tools failed and why.
