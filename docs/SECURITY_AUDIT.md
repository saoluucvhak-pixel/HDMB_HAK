# HDMB security audit

Reviewed Code.gs and 34_PhanQuyen.gs.

- SSO nonce check/get and put are separate operations. Add LockService around nonce consumption to prevent concurrent replay.
- Session token is accepted from a URL query parameter. Review leakage risks and replace with a safer iframe handoff.
- Test access controls for XEM, NHAP_LIEU, and ADMIN roles.
- Validate changes against an isolated Apps Script deployment before merging.
