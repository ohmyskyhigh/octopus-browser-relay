# MCP Binding Contract v2

Every target-specific MCP call carries an opaque broker-issued `bindingRef`. The bearer token authenticates the agent; `bindingRef` selects the claimed agent-to-extension relationship. The broker routes only when one active binding row matches both values.

## Provisioning

1. Create an agent principal and credential.
2. Pair one extension target under an administrative alias.
3. Call `bind_agent({ principalId, alias })` as an administrator.
4. Give the agent its credential. The agent obtains its reference with `get_my_binding({})`.

Only one active binding may exist for a principal and for a target. `unbind_agent` revokes the reference and releases that principal's active lease on the target.

## Routed calls

```json
{
  "bindingRef": "br_opaque_broker_issued_reference",
  "operation": "snapshot",
  "parameters": {},
  "deadlineMs": 30000,
  "idempotencyKey": "logical-operation-key"
}
```

The same `bindingRef` is required by `get_target`, `acquire_session`, `release_session`, `dispatch`, and `get_command`. A session handle is optional routing metadata beneath the binding; it never replaces the binding.

The broker returns `INVALID_BINDING`, `BINDING_FORBIDDEN`, `BINDING_REVOKED`, or `BINDING_CONFLICT` when the reference cannot be used. Raw target IDs and connection IDs are never returned through MCP.
