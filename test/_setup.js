require('source-map-support').install()

import FabricHub from 'msg-fabric-core'
import tcp from 'msg-fabric-core/cjs/plugin-net-tcp'
import swim from '..'

const Hub = FabricHub.plugin( tcp(), swim() )
export default Hub
