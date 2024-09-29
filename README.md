# Guide on how to reproduce bug

- Create a stack
- Select it
- `pulumi up`
- `pulumi preview`
- at this point it sometimes shows changes and sometimes behaves as it should, it it doesn't, change any `true` to `false` in [clusters.ts](clusters.ts#L12) file & run `pulumi up` again
- it should all the configs being changed in the diff
- `pulumi destroy` if you're done (dw dependencies configured)
