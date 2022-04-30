# msg-fabric-plugin-swim-discovery

(DEPRECATED)

**SWIM: Scalable Weakly-consistent Infection-style Process Group Membership Protocol**

SWIM peer-to-peer discovery for [msg-fabric](https://www.npmjs.com/package/msg-fabric).

- [SWIM](http://www.cs.cornell.edu/~asdas/research/dsn02-SWIM.pdf) Paper
- [swim](https://www.npmjs.com/package/swim) Node package


## Plugin Installation

```javascript
import FabricHub from 'msg-fabric-core'
import swim_discovery from 'msg-fabric-plugin-swim-discovery'

const ec_pem = require('ec-pem')
const Hub = FabricHub.plugin(swim_discovery({ec_pem}))
```
