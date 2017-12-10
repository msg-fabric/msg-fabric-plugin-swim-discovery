'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var dns = require('dns');
var SWIM = _interopDefault(require('swim'));

const ts_2015_epoch = 1420070400000; // new Date('2015-01-01T00:00:00.000Z').valueOf()

swim_plugin.default_options = {
  swim_port: 2700,
  swim_config: {
    interval: 100,
    joinTimeout: 300,
    pingTimeout: 30,
    pingReqTimeout: 80,
    pingReqGroupSize: 2 } };

function swim_plugin(plugin_options) {
  plugin_options = Object.assign({}, swim_plugin.default_options, plugin_options);

  return function (hub) {
    hub.createSWIM = createSWIM;

    function assignSWIMMeta(meta, ...args) {
      const { id_self: id_router, ec_pub_id } = hub.router;
      const id_info = ec_pub_id ? { id_router,
        ec_pub_id: ec_pub_id.toString('base64') } : { id_router };

      return Object.assign({}, meta, ...args, id_info);
    }

    function createSWIM({ host, meta, channel, swim_port, incarnation }) {
      let conn_info = 'function' === typeof channel ? channel : channel.conn_info;
      if (conn_info) {
        const { ip_server, ip_local } = conn_info();
        channel = (ip_server || ip_local).asURL();
        if (!host) {
          if (!swim_port) {
            swim_port = plugin_options.swim_port;
          }
          host = `${(ip_server || ip_local).address}:${swim_port}`;
        }
      }

      if (!host) {
        throw new Error(`SWIM package requires a valid "host" parameter`);
      }
      if (null == incarnation) {
        // use a rough time-based incarnation to help with reusing ip/port
        incarnation = Date.now() - ts_2015_epoch;
      }

      meta = assignSWIMMeta(meta, channel && { channel });
      const swim_opts = Object.assign({}, plugin_options.swim_config, { local: { host, meta, incarnation } });

      const swim = new SWIM(swim_opts);
      return new swim_plugin.SwimDiscovery(hub, swim);
    }
  };
}

class SwimDiscovery {
  constructor(hub, swim) {
    this._subscriberList = [];

    const byId = new Map();
    Object.defineProperties(this, {
      hub: { value: hub },
      swim: { value: swim },
      byId: { value: byId } });

    this._bindSwimUpdates(swim, byId);
  }

  localhost() {
    return this.swim.localhost();
  }

  bootstrap(swim_hosts = [], swim_port) {
    const swim = this.swim;
    if ('string' === typeof swim_hosts) {
      dns.resolve(swim_hosts, (err, hosts) => {
        swim_hosts = hosts.map(host => `${host}:${swim_port}`);
        swim.bootstrap(swim_hosts);
      });
      return this;
    } else if (Array.isArray(swim_hosts)) {
      if (swim_port) {
        swim_hosts = swim_hosts.map(host => host.includes(':') ? host : `${host}:${swim_port}`);
      }
      swim.bootstrap(swim_hosts);
      return this;
    }

    throw new TypeError(`Unexpected 'swim_hosts' parameter format.`);
  }

  _bindSwimUpdates(swim, byId) {
    const updateProps = { byId: { value: byId } };
    const pqueue = this.promiseQueue(() => {
      const updates = Object.defineProperties([], updateProps);
      const ans = sleep(0, updates);
      ans.updates = updates;
      for (const sub of this._subscriberList) {
        ans.then(sub);
      }
      return ans;
    });

    {
      const { host, meta } = swim.opts.local;
      _on_updateEntry(meta, 'self', host);
    }

    {
      const swim_state_lut = this.swim_state_lut.slice();
      swim.on('update', evt => {
        _on_updateEntry(evt.meta, swim_state_lut[evt.state], evt.host);
      });
    }

    function _on_updateEntry(meta, swim_state, swim_host) {
      const { id_router, ec_pub_id } = meta;
      const cur = byId.get(id_router);
      if (undefined !== cur && ec_pub_id != cur.ec_pub_id) {
        return; // refuse to override existing entries with mismatched ec_pub_id
      }const entry = Object.assign({}, meta, { swim_state, swim_host, swim_ts: new Date() });
      byId.set(id_router, entry);
      pqueue().updates.push(entry);
    }
  }

  registerRouterDiscovery(hub) {
    if (null == hub) {
      hub = this.hub;
    }

    const resolveRouterId = async id_router => {
      const entry = this.byId.get(id_router);
      if (undefined === entry) {
        return;
      }

      try {
        const chan = await hub.connect(entry.channel);
        return chan.sendRaw;
      } catch (err) {
        this.byId.delete(id_router);
        if (err && 'ECONNREFUSED' !== err.code) {
          throw err; // re-throw if not recognized
        }
      }
    };hub.router.routeDiscovery.push(resolveRouterId);
    return this;
  }
  subscribe(callback) {
    this._subscriberList.push(callback);
    return this;
  }
}

swim_plugin.SwimDiscovery = SwimDiscovery;
Object.assign(SwimDiscovery.prototype, {
  swim_state_lut: ['alive', 'suspect', 'dead'],
  promiseQueue });

function sleep(ms, ctx) {
  return new Promise(resolve$$1 => setTimeout(resolve$$1, ms, ctx));
}

function promiseQueue(nextPromise) {
  let tip = null;
  return function () {
    if (null === tip) {
      tip = nextPromise();
      tip.then(clear_tip);
    }
    return tip;
  };

  function clear_tip() {
    tip = null;
  }
}

module.exports = swim_plugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3dpbV9kaXNjb3ZlcnkuanMiLCJzb3VyY2VzIjpbIi4uL2NvZGUvc3dpbV9kaXNjb3ZlcnkuanN5Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7cmVzb2x2ZSBhcyBkbnNfcmVzb2x2ZX0gZnJvbSAnZG5zJ1xuaW1wb3J0IFNXSU0gZnJvbSAnc3dpbSdcblxuY29uc3QgdHNfMjAxNV9lcG9jaCA9IDE0MjAwNzA0MDAwMDAgLy8gbmV3IERhdGUoJzIwMTUtMDEtMDFUMDA6MDA6MDAuMDAwWicpLnZhbHVlT2YoKVxuXG5zd2ltX3BsdWdpbi5kZWZhdWx0X29wdGlvbnMgPSBAe31cbiAgc3dpbV9wb3J0OiAyNzAwXG4gIHN3aW1fY29uZmlnOiBAe31cbiAgICBpbnRlcnZhbDogMTAwXG4gICAgam9pblRpbWVvdXQ6IDMwMFxuICAgIHBpbmdUaW1lb3V0OiAzMFxuICAgIHBpbmdSZXFUaW1lb3V0OiA4MFxuICAgIHBpbmdSZXFHcm91cFNpemU6IDJcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc3dpbV9wbHVnaW4ocGx1Z2luX29wdGlvbnMpIDo6XG4gIHBsdWdpbl9vcHRpb25zID0gT2JqZWN0LmFzc2lnbiBAIHt9LCBzd2ltX3BsdWdpbi5kZWZhdWx0X29wdGlvbnMsIHBsdWdpbl9vcHRpb25zXG5cbiAgcmV0dXJuIGZ1bmN0aW9uIChodWIpIDo6XG4gICAgaHViLmNyZWF0ZVNXSU0gPSBjcmVhdGVTV0lNXG5cbiAgICBmdW5jdGlvbiBhc3NpZ25TV0lNTWV0YShtZXRhLCAuLi5hcmdzKSA6OlxuICAgICAgY29uc3Qge2lkX3NlbGY6IGlkX3JvdXRlciwgZWNfcHViX2lkfSA9IGh1Yi5yb3V0ZXJcbiAgICAgIGNvbnN0IGlkX2luZm8gPSBlY19wdWJfaWQgXG4gICAgICAgID8gQHt9IGlkX3JvdXRlclxuICAgICAgICAgICAgICBlY19wdWJfaWQ6IGVjX3B1Yl9pZC50b1N0cmluZygnYmFzZTY0JylcbiAgICAgICAgOiBAe30gaWRfcm91dGVyXG5cbiAgICAgIHJldHVybiBPYmplY3QuYXNzaWduIEAge30sIG1ldGEsIC4uLmFyZ3MsIGlkX2luZm9cblxuICAgIGZ1bmN0aW9uIGNyZWF0ZVNXSU0oe2hvc3QsIG1ldGEsIGNoYW5uZWwsIHN3aW1fcG9ydCwgaW5jYXJuYXRpb259KSA6OlxuICAgICAgbGV0IGNvbm5faW5mbyA9ICdmdW5jdGlvbicgPT09IHR5cGVvZiBjaGFubmVsIFxuICAgICAgICA/IGNoYW5uZWwgOiBjaGFubmVsLmNvbm5faW5mb1xuICAgICAgaWYgY29ubl9pbmZvIDo6XG4gICAgICAgIGNvbnN0IHtpcF9zZXJ2ZXIsIGlwX2xvY2FsfSA9IGNvbm5faW5mbygpXG4gICAgICAgIGNoYW5uZWwgPSAoaXBfc2VydmVyIHx8IGlwX2xvY2FsKS5hc1VSTCgpXG4gICAgICAgIGlmICEgaG9zdCA6OlxuICAgICAgICAgIGlmICEgc3dpbV9wb3J0IDo6IHN3aW1fcG9ydCA9IHBsdWdpbl9vcHRpb25zLnN3aW1fcG9ydFxuICAgICAgICAgIGhvc3QgPSBgJHsoaXBfc2VydmVyIHx8IGlwX2xvY2FsKS5hZGRyZXNzfToke3N3aW1fcG9ydH1gXG5cbiAgICAgIGlmICEgaG9zdCA6OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgQCBgU1dJTSBwYWNrYWdlIHJlcXVpcmVzIGEgdmFsaWQgXCJob3N0XCIgcGFyYW1ldGVyYFxuICAgICAgaWYgbnVsbCA9PSBpbmNhcm5hdGlvbiA6OlxuICAgICAgICAvLyB1c2UgYSByb3VnaCB0aW1lLWJhc2VkIGluY2FybmF0aW9uIHRvIGhlbHAgd2l0aCByZXVzaW5nIGlwL3BvcnRcbiAgICAgICAgaW5jYXJuYXRpb24gPSBEYXRlLm5vdygpIC0gdHNfMjAxNV9lcG9jaFxuXG4gICAgICBtZXRhID0gYXNzaWduU1dJTU1ldGEgQCBtZXRhLCBjaGFubmVsICYmIEB7fSBjaGFubmVsXG4gICAgICBjb25zdCBzd2ltX29wdHMgPSBPYmplY3QuYXNzaWduIEBcbiAgICAgICAge30sIHBsdWdpbl9vcHRpb25zLnN3aW1fY29uZmlnXG4gICAgICAgIEA6IGxvY2FsOiBAe30gaG9zdCwgbWV0YSwgaW5jYXJuYXRpb25cblxuICAgICAgY29uc3Qgc3dpbSA9IG5ldyBTV0lNIEAgc3dpbV9vcHRzXG4gICAgICByZXR1cm4gbmV3IHN3aW1fcGx1Z2luLlN3aW1EaXNjb3ZlcnkgQCBodWIsIHN3aW1cblxuXG5cbmNsYXNzIFN3aW1EaXNjb3ZlcnkgOjpcbiAgY29uc3RydWN0b3IoaHViLCBzd2ltKSA6OlxuICAgIGNvbnN0IGJ5SWQgPSBuZXcgTWFwKClcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyBAIHRoaXMsIEA6XG4gICAgICBodWI6IEA6IHZhbHVlOiBodWJcbiAgICAgIHN3aW06IEA6IHZhbHVlOiBzd2ltXG4gICAgICBieUlkOiBAOiB2YWx1ZTogYnlJZFxuXG4gICAgdGhpcy5fYmluZFN3aW1VcGRhdGVzKHN3aW0sIGJ5SWQpXG5cbiAgbG9jYWxob3N0KCkgOjogcmV0dXJuIHRoaXMuc3dpbS5sb2NhbGhvc3QoKVxuXG4gIGJvb3RzdHJhcChzd2ltX2hvc3RzPVtdLCBzd2ltX3BvcnQpIDo6XG4gICAgY29uc3Qgc3dpbSA9IHRoaXMuc3dpbVxuICAgIGlmICdzdHJpbmcnID09PSB0eXBlb2Ygc3dpbV9ob3N0cyA6OlxuICAgICAgZG5zX3Jlc29sdmUgQCBzd2ltX2hvc3RzLCAoZXJyLCBob3N0cykgPT4gOjpcbiAgICAgICAgc3dpbV9ob3N0cyA9IGhvc3RzLm1hcCBAIGhvc3QgPT4gYCR7aG9zdH06JHtzd2ltX3BvcnR9YFxuICAgICAgICBzd2ltLmJvb3RzdHJhcCBAIHN3aW1faG9zdHNcbiAgICAgIHJldHVybiB0aGlzXG5cbiAgICBlbHNlIGlmIEFycmF5LmlzQXJyYXkgQCBzd2ltX2hvc3RzIDo6XG4gICAgICBpZiBzd2ltX3BvcnQgOjpcbiAgICAgICAgc3dpbV9ob3N0cyA9IHN3aW1faG9zdHMubWFwIEAgaG9zdCA9PlxuICAgICAgICAgIGhvc3QuaW5jbHVkZXMoJzonKSA/IGhvc3QgOiBgJHtob3N0fToke3N3aW1fcG9ydH1gXG4gICAgICBzd2ltLmJvb3RzdHJhcCBAIHN3aW1faG9zdHNcbiAgICAgIHJldHVybiB0aGlzXG5cbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yIEAgYFVuZXhwZWN0ZWQgJ3N3aW1faG9zdHMnIHBhcmFtZXRlciBmb3JtYXQuYFxuXG5cbiAgX2JpbmRTd2ltVXBkYXRlcyhzd2ltLCBieUlkKSA6OlxuICAgIGNvbnN0IHVwZGF0ZVByb3BzID0gQHt9IGJ5SWQ6IEA6IHZhbHVlOiBieUlkXG4gICAgY29uc3QgcHF1ZXVlID0gdGhpcy5wcm9taXNlUXVldWUgQCAoKSA9PiA6OlxuICAgICAgY29uc3QgdXBkYXRlcyA9IE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzIEAgW10sIHVwZGF0ZVByb3BzXG4gICAgICBjb25zdCBhbnMgPSBzbGVlcCgwLCB1cGRhdGVzKVxuICAgICAgYW5zLnVwZGF0ZXMgPSB1cGRhdGVzXG4gICAgICBmb3IgY29uc3Qgc3ViIG9mIHRoaXMuX3N1YnNjcmliZXJMaXN0IDo6XG4gICAgICAgIGFucy50aGVuKHN1YilcbiAgICAgIHJldHVybiBhbnNcblxuICAgIDo6XG4gICAgICBjb25zdCB7aG9zdCwgbWV0YX0gPSBzd2ltLm9wdHMubG9jYWxcbiAgICAgIF9vbl91cGRhdGVFbnRyeSBAIG1ldGEsICdzZWxmJywgaG9zdFxuXG4gICAgOjpcbiAgICAgIGNvbnN0IHN3aW1fc3RhdGVfbHV0ID0gdGhpcy5zd2ltX3N0YXRlX2x1dC5zbGljZSgpXG4gICAgICBzd2ltLm9uIEAgJ3VwZGF0ZScsIGV2dCA9PiA6OlxuICAgICAgICBfb25fdXBkYXRlRW50cnkgQCBldnQubWV0YSwgc3dpbV9zdGF0ZV9sdXRbZXZ0LnN0YXRlXSwgZXZ0Lmhvc3RcblxuICAgIGZ1bmN0aW9uIF9vbl91cGRhdGVFbnRyeShtZXRhLCBzd2ltX3N0YXRlLCBzd2ltX2hvc3QpIDo6XG4gICAgICBjb25zdCB7aWRfcm91dGVyLCBlY19wdWJfaWR9ID0gbWV0YVxuICAgICAgY29uc3QgY3VyID0gYnlJZC5nZXQoaWRfcm91dGVyKVxuICAgICAgaWYgdW5kZWZpbmVkICE9PSBjdXIgJiYgZWNfcHViX2lkICE9IGN1ci5lY19wdWJfaWQgOjpcbiAgICAgICAgcmV0dXJuIC8vIHJlZnVzZSB0byBvdmVycmlkZSBleGlzdGluZyBlbnRyaWVzIHdpdGggbWlzbWF0Y2hlZCBlY19wdWJfaWRcblxuICAgICAgY29uc3QgZW50cnkgPSBPYmplY3QuYXNzaWduIEAge30sIG1ldGEsIEB7fSBzd2ltX3N0YXRlLCBzd2ltX2hvc3QsIHN3aW1fdHM6IG5ldyBEYXRlKClcbiAgICAgIGJ5SWQuc2V0IEAgaWRfcm91dGVyLCBlbnRyeVxuICAgICAgcHF1ZXVlKCkudXBkYXRlcy5wdXNoIEAgZW50cnlcblxuXG4gIHJlZ2lzdGVyUm91dGVyRGlzY292ZXJ5KGh1YikgOjpcbiAgICBpZiBudWxsID09IGh1YiA6OiBodWIgPSB0aGlzLmh1YlxuXG4gICAgY29uc3QgcmVzb2x2ZVJvdXRlcklkID0gYXN5bmMgaWRfcm91dGVyID0+IDo6XG4gICAgICBjb25zdCBlbnRyeSA9IHRoaXMuYnlJZC5nZXQoaWRfcm91dGVyKVxuICAgICAgaWYgdW5kZWZpbmVkID09PSBlbnRyeSA6OiByZXR1cm5cblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGNvbnN0IGNoYW4gPSBhd2FpdCBodWIuY29ubmVjdCBAIGVudHJ5LmNoYW5uZWxcbiAgICAgICAgcmV0dXJuIGNoYW4uc2VuZFJhd1xuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIHRoaXMuYnlJZC5kZWxldGUoaWRfcm91dGVyKVxuICAgICAgICBpZiBlcnIgJiYgJ0VDT05OUkVGVVNFRCcgIT09IGVyci5jb2RlIDo6XG4gICAgICAgICAgdGhyb3cgZXJyIC8vIHJlLXRocm93IGlmIG5vdCByZWNvZ25pemVkXG5cbiAgICBodWIucm91dGVyLnJvdXRlRGlzY292ZXJ5LnB1c2ggQCByZXNvbHZlUm91dGVySWRcbiAgICByZXR1cm4gdGhpc1xuXG5cbiAgX3N1YnNjcmliZXJMaXN0ID0gW11cbiAgc3Vic2NyaWJlKGNhbGxiYWNrKSA6OlxuICAgIHRoaXMuX3N1YnNjcmliZXJMaXN0LnB1c2ggQCBjYWxsYmFja1xuICAgIHJldHVybiB0aGlzXG5cbnN3aW1fcGx1Z2luLlN3aW1EaXNjb3ZlcnkgPSBTd2ltRGlzY292ZXJ5XG5PYmplY3QuYXNzaWduIEAgU3dpbURpc2NvdmVyeS5wcm90b3R5cGUsIEA6XG4gIHN3aW1fc3RhdGVfbHV0OiBAW10gJ2FsaXZlJywgJ3N1c3BlY3QnLCAnZGVhZCdcbiAgcHJvbWlzZVF1ZXVlXG5cblxuZnVuY3Rpb24gc2xlZXAobXMsIGN0eCkgOjpcbiAgcmV0dXJuIG5ldyBQcm9taXNlIEAgcmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zLCBjdHgpXG5cbmZ1bmN0aW9uIHByb21pc2VRdWV1ZShuZXh0UHJvbWlzZSkgOjpcbiAgbGV0IHRpcCA9IG51bGxcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIDo6XG4gICAgaWYgbnVsbCA9PT0gdGlwIDo6XG4gICAgICB0aXAgPSBuZXh0UHJvbWlzZSgpXG4gICAgICB0aXAudGhlbiBAIGNsZWFyX3RpcFxuICAgIHJldHVybiB0aXBcblxuICBmdW5jdGlvbiBjbGVhcl90aXAoKSA6OlxuICAgIHRpcCA9IG51bGxcblxuIl0sIm5hbWVzIjpbInRzXzIwMTVfZXBvY2giLCJzd2ltX3BsdWdpbiIsImRlZmF1bHRfb3B0aW9ucyIsInBsdWdpbl9vcHRpb25zIiwiT2JqZWN0IiwiYXNzaWduIiwiaHViIiwiY3JlYXRlU1dJTSIsImFzc2lnblNXSU1NZXRhIiwibWV0YSIsImFyZ3MiLCJpZF9zZWxmIiwiaWRfcm91dGVyIiwiZWNfcHViX2lkIiwicm91dGVyIiwiaWRfaW5mbyIsInRvU3RyaW5nIiwiaG9zdCIsImNoYW5uZWwiLCJzd2ltX3BvcnQiLCJpbmNhcm5hdGlvbiIsImNvbm5faW5mbyIsImlwX3NlcnZlciIsImlwX2xvY2FsIiwiYXNVUkwiLCJhZGRyZXNzIiwiRXJyb3IiLCJEYXRlIiwibm93Iiwic3dpbV9vcHRzIiwic3dpbV9jb25maWciLCJsb2NhbCIsInN3aW0iLCJTV0lNIiwiU3dpbURpc2NvdmVyeSIsIl9zdWJzY3JpYmVyTGlzdCIsImJ5SWQiLCJNYXAiLCJkZWZpbmVQcm9wZXJ0aWVzIiwidmFsdWUiLCJfYmluZFN3aW1VcGRhdGVzIiwibG9jYWxob3N0Iiwic3dpbV9ob3N0cyIsImVyciIsImhvc3RzIiwibWFwIiwiYm9vdHN0cmFwIiwiQXJyYXkiLCJpc0FycmF5IiwiaW5jbHVkZXMiLCJUeXBlRXJyb3IiLCJ1cGRhdGVQcm9wcyIsInBxdWV1ZSIsInByb21pc2VRdWV1ZSIsInVwZGF0ZXMiLCJhbnMiLCJzbGVlcCIsInN1YiIsInRoZW4iLCJvcHRzIiwic3dpbV9zdGF0ZV9sdXQiLCJzbGljZSIsIm9uIiwiZXZ0Iiwic3RhdGUiLCJfb25fdXBkYXRlRW50cnkiLCJzd2ltX3N0YXRlIiwic3dpbV9ob3N0IiwiY3VyIiwiZ2V0IiwidW5kZWZpbmVkIiwiZW50cnkiLCJzd2ltX3RzIiwic2V0IiwicHVzaCIsInJlc29sdmVSb3V0ZXJJZCIsImNoYW4iLCJjb25uZWN0Iiwic2VuZFJhdyIsImRlbGV0ZSIsImNvZGUiLCJyb3V0ZURpc2NvdmVyeSIsImNhbGxiYWNrIiwicHJvdG90eXBlIiwibXMiLCJjdHgiLCJQcm9taXNlIiwicmVzb2x2ZSIsInNldFRpbWVvdXQiLCJuZXh0UHJvbWlzZSIsInRpcCIsImNsZWFyX3RpcCJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUdBLE1BQU1BLGdCQUFnQixhQUF0Qjs7QUFFQUMsWUFBWUMsZUFBWixHQUE4QjthQUNqQixJQURpQjtlQUVmO2NBQ0QsR0FEQztpQkFFRSxHQUZGO2lCQUdFLEVBSEY7b0JBSUssRUFKTDtzQkFLTyxDQUxQLEVBRmUsRUFBOUI7O0FBU0EsQUFBZSxTQUFTRCxXQUFULENBQXFCRSxjQUFyQixFQUFxQzttQkFDakNDLE9BQU9DLE1BQVAsQ0FBZ0IsRUFBaEIsRUFBb0JKLFlBQVlDLGVBQWhDLEVBQWlEQyxjQUFqRCxDQUFqQjs7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
