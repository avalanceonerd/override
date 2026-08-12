# Weibo LPX Design

## Goal

Create a self-contained Loon Weibo ad-removal LPX that preserves the current Kelee plugin's coverage and UI-cleanup behavior while preventing normal comments from being deleted as ads.

## Source Baseline

The baseline is Kelee's `Weibo_remove_ads.lpx` dated 2026-06-01 and its corresponding `Weibo_remove_ads.js`. The LPX retains its current Rule, Rewrite, MITM, and endpoint-matching coverage.

## Files

- `weibo/Weibo_remove_ads.lpx`: the installable Loon plugin. Its script entries refer only to the versioned JavaScript file in this repository.
- `weibo/js/weibo-remove-ads.js`: the response-processing script, based on the Kelee behavior with safer scope boundaries.
- `weibo/test/weibo-remove-ads.test.js`: Node-based regression tests that execute the script in a mocked Loon runtime.
- `weibo/test/fixtures/build-comments.json`: redacted, minimal fixtures derived from the supplied HAR response shapes.

## Filtering Boundaries

`isFeedAd` is used only for feed-shaped objects in timeline, search, profile, video, and repost endpoints. It retains the baseline checks for explicit feed ad metadata such as `mblogtypename`, `readtimetype`, `promotion`, content-auth data, and ad-material flags.

`isCommentAd` is used only for comment endpoints. In `comments/build_comments`, the script preserves each user comment (`type: 0`) even when its nested data has `readtimetype: "adMblog"`. It removes explicit ad entries (`type: 1` or an outer `adType`) and the baseline non-comment UI entries (`type: 6`, `15`, and `41`). The same separation applies to `root_comments`.

The script only uses exact system-account names when hiding pseudo-comments. It does not delete a comment merely because the author name contains the word `微博`.

## Safety

All JSON processing is guarded. A malformed or empty response body is returned unchanged so a script exception cannot blank a Weibo page. Comment pagination and count fields are never edited; only display arrays are filtered.

## Validation

Tests execute the script against three representative `build_comments` cases from the supplied HAR:

- a normal comment list retains 76 comments;
- an ad-sponsored parent post with seven `type: 0` comments carrying `readtimetype: "adMblog"` retains all seven comments and removes the explicit ad item;
- a list with thirteen normal comments and two explicit ads retains thirteen comments.

Tests also verify that a pseudo-comment with a normal nickname containing `微博` is retained, explicit comment advertising is removed, malformed JSON is passed through unchanged, and every LPX script entry uses the local repository script URL.

## Delivery

Changes are committed intentionally and pushed to `avalanceonerd/override` after tests pass. Public versus private repository access for Loon is decided after implementation, as requested.
