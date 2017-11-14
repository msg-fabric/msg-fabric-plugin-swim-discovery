'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var dns = require('dns');
var SWIM = _interopDefault(require('swim'));

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

    function createSWIM({ host, meta, channel, swim_port }) {
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

      meta = assignSWIMMeta(meta, channel && { channel });
      const swim_opts = Object.assign({}, plugin_options.swim_config, { local: { host, meta } });

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
        swim_hosts = swim_hosts.map(host => `${host}:${swim_port}`);
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

      const chan = await hub.connect(entry.channel);
      return chan.sendRaw;
    };

    hub.router.routeDiscovery.push(resolveRouterId);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3dpbV9kaXNjb3ZlcnkuanMiLCJzb3VyY2VzIjpbIi4uL2NvZGUvc3dpbV9kaXNjb3ZlcnkuanN5Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7cmVzb2x2ZSBhcyBkbnNfcmVzb2x2ZX0gZnJvbSAnZG5zJ1xuaW1wb3J0IFNXSU0gZnJvbSAnc3dpbSdcblxuc3dpbV9wbHVnaW4uZGVmYXVsdF9vcHRpb25zID0gQHt9XG4gIHN3aW1fcG9ydDogMjcwMFxuICBzd2ltX2NvbmZpZzogQHt9XG4gICAgaW50ZXJ2YWw6IDEwMFxuICAgIGpvaW5UaW1lb3V0OiAzMDBcbiAgICBwaW5nVGltZW91dDogMzBcbiAgICBwaW5nUmVxVGltZW91dDogODBcbiAgICBwaW5nUmVxR3JvdXBTaXplOiAyXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHN3aW1fcGx1Z2luKHBsdWdpbl9vcHRpb25zKSA6OlxuICBwbHVnaW5fb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24gQCB7fSwgc3dpbV9wbHVnaW4uZGVmYXVsdF9vcHRpb25zLCBwbHVnaW5fb3B0aW9uc1xuXG4gIHJldHVybiBmdW5jdGlvbiAoaHViKSA6OlxuICAgIGh1Yi5jcmVhdGVTV0lNID0gY3JlYXRlU1dJTVxuXG4gICAgZnVuY3Rpb24gYXNzaWduU1dJTU1ldGEobWV0YSwgLi4uYXJncykgOjpcbiAgICAgIGNvbnN0IHtpZF9zZWxmOiBpZF9yb3V0ZXIsIGVjX3B1Yl9pZH0gPSBodWIucm91dGVyXG4gICAgICBjb25zdCBpZF9pbmZvID0gZWNfcHViX2lkIFxuICAgICAgICA/IEB7fSBpZF9yb3V0ZXJcbiAgICAgICAgICAgICAgZWNfcHViX2lkOiBlY19wdWJfaWQudG9TdHJpbmcoJ2Jhc2U2NCcpXG4gICAgICAgIDogQHt9IGlkX3JvdXRlclxuXG4gICAgICByZXR1cm4gT2JqZWN0LmFzc2lnbiBAIHt9LCBtZXRhLCAuLi5hcmdzLCBpZF9pbmZvXG5cbiAgICBmdW5jdGlvbiBjcmVhdGVTV0lNKHtob3N0LCBtZXRhLCBjaGFubmVsLCBzd2ltX3BvcnR9KSA6OlxuICAgICAgbGV0IGNvbm5faW5mbyA9ICdmdW5jdGlvbicgPT09IHR5cGVvZiBjaGFubmVsIFxuICAgICAgICA/IGNoYW5uZWwgOiBjaGFubmVsLmNvbm5faW5mb1xuICAgICAgaWYgY29ubl9pbmZvIDo6XG4gICAgICAgIGNvbnN0IHtpcF9zZXJ2ZXIsIGlwX2xvY2FsfSA9IGNvbm5faW5mbygpXG4gICAgICAgIGNoYW5uZWwgPSAoaXBfc2VydmVyIHx8IGlwX2xvY2FsKS5hc1VSTCgpXG4gICAgICAgIGlmICEgaG9zdCA6OlxuICAgICAgICAgIGlmICEgc3dpbV9wb3J0IDo6IHN3aW1fcG9ydCA9IHBsdWdpbl9vcHRpb25zLnN3aW1fcG9ydFxuICAgICAgICAgIGhvc3QgPSBgJHsoaXBfc2VydmVyIHx8IGlwX2xvY2FsKS5hZGRyZXNzfToke3N3aW1fcG9ydH1gXG5cbiAgICAgIGlmICEgaG9zdCA6OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgQCBgU1dJTSBwYWNrYWdlIHJlcXVpcmVzIGEgdmFsaWQgXCJob3N0XCIgcGFyYW1ldGVyYFxuXG4gICAgICBtZXRhID0gYXNzaWduU1dJTU1ldGEgQCBtZXRhLCBjaGFubmVsICYmIEB7fSBjaGFubmVsXG4gICAgICBjb25zdCBzd2ltX29wdHMgPSBPYmplY3QuYXNzaWduIEBcbiAgICAgICAge30sIHBsdWdpbl9vcHRpb25zLnN3aW1fY29uZmlnXG4gICAgICAgIEA6IGxvY2FsOiBAe30gaG9zdCwgbWV0YVxuXG4gICAgICBjb25zdCBzd2ltID0gbmV3IFNXSU0gQCBzd2ltX29wdHNcbiAgICAgIHJldHVybiBuZXcgc3dpbV9wbHVnaW4uU3dpbURpc2NvdmVyeSBAIGh1Yiwgc3dpbVxuXG5cblxuY2xhc3MgU3dpbURpc2NvdmVyeSA6OlxuICBjb25zdHJ1Y3RvcihodWIsIHN3aW0pIDo6XG4gICAgY29uc3QgYnlJZCA9IG5ldyBNYXAoKVxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzIEAgdGhpcywgQDpcbiAgICAgIGh1YjogQDogdmFsdWU6IGh1YlxuICAgICAgc3dpbTogQDogdmFsdWU6IHN3aW1cbiAgICAgIGJ5SWQ6IEA6IHZhbHVlOiBieUlkXG5cbiAgICB0aGlzLl9iaW5kU3dpbVVwZGF0ZXMoc3dpbSwgYnlJZClcblxuICBsb2NhbGhvc3QoKSA6OiByZXR1cm4gdGhpcy5zd2ltLmxvY2FsaG9zdCgpXG5cbiAgYm9vdHN0cmFwKHN3aW1faG9zdHM9W10sIHN3aW1fcG9ydCkgOjpcbiAgICBjb25zdCBzd2ltID0gdGhpcy5zd2ltXG4gICAgaWYgJ3N0cmluZycgPT09IHR5cGVvZiBzd2ltX2hvc3RzIDo6XG4gICAgICBkbnNfcmVzb2x2ZSBAIHN3aW1faG9zdHMsIChlcnIsIGhvc3RzKSA9PiA6OlxuICAgICAgICBzd2ltX2hvc3RzID0gaG9zdHMubWFwIEAgaG9zdCA9PiBgJHtob3N0fToke3N3aW1fcG9ydH1gXG4gICAgICAgIHN3aW0uYm9vdHN0cmFwIEAgc3dpbV9ob3N0c1xuICAgICAgcmV0dXJuIHRoaXNcblxuICAgIGVsc2UgaWYgQXJyYXkuaXNBcnJheSBAIHN3aW1faG9zdHMgOjpcbiAgICAgIGlmIHN3aW1fcG9ydCA6OlxuICAgICAgICBzd2ltX2hvc3RzID0gc3dpbV9ob3N0cy5tYXAgQCBob3N0ID0+IGAke2hvc3R9OiR7c3dpbV9wb3J0fWBcbiAgICAgIHN3aW0uYm9vdHN0cmFwIEAgc3dpbV9ob3N0c1xuICAgICAgcmV0dXJuIHRoaXNcblxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IgQCBgVW5leHBlY3RlZCAnc3dpbV9ob3N0cycgcGFyYW1ldGVyIGZvcm1hdC5gXG5cblxuICBfYmluZFN3aW1VcGRhdGVzKHN3aW0sIGJ5SWQpIDo6XG4gICAgY29uc3QgdXBkYXRlUHJvcHMgPSBAe30gYnlJZDogQDogdmFsdWU6IGJ5SWRcbiAgICBjb25zdCBwcXVldWUgPSB0aGlzLnByb21pc2VRdWV1ZSBAICgpID0+IDo6XG4gICAgICBjb25zdCB1cGRhdGVzID0gT2JqZWN0LmRlZmluZVByb3BlcnRpZXMgQCBbXSwgdXBkYXRlUHJvcHNcbiAgICAgIGNvbnN0IGFucyA9IHNsZWVwKDAsIHVwZGF0ZXMpXG4gICAgICBhbnMudXBkYXRlcyA9IHVwZGF0ZXNcbiAgICAgIGZvciBjb25zdCBzdWIgb2YgdGhpcy5fc3Vic2NyaWJlckxpc3QgOjpcbiAgICAgICAgYW5zLnRoZW4oc3ViKVxuICAgICAgcmV0dXJuIGFuc1xuXG4gICAgOjpcbiAgICAgIGNvbnN0IHtob3N0LCBtZXRhfSA9IHN3aW0ub3B0cy5sb2NhbFxuICAgICAgX29uX3VwZGF0ZUVudHJ5IEAgbWV0YSwgJ3NlbGYnLCBob3N0XG5cbiAgICA6OlxuICAgICAgY29uc3Qgc3dpbV9zdGF0ZV9sdXQgPSB0aGlzLnN3aW1fc3RhdGVfbHV0LnNsaWNlKClcbiAgICAgIHN3aW0ub24gQCAndXBkYXRlJywgZXZ0ID0+IDo6XG4gICAgICAgIF9vbl91cGRhdGVFbnRyeSBAIGV2dC5tZXRhLCBzd2ltX3N0YXRlX2x1dFtldnQuc3RhdGVdLCBldnQuaG9zdFxuXG4gICAgZnVuY3Rpb24gX29uX3VwZGF0ZUVudHJ5KG1ldGEsIHN3aW1fc3RhdGUsIHN3aW1faG9zdCkgOjpcbiAgICAgIGNvbnN0IHtpZF9yb3V0ZXIsIGVjX3B1Yl9pZH0gPSBtZXRhXG4gICAgICBjb25zdCBjdXIgPSBieUlkLmdldChpZF9yb3V0ZXIpXG4gICAgICBpZiB1bmRlZmluZWQgIT09IGN1ciAmJiBlY19wdWJfaWQgIT0gY3VyLmVjX3B1Yl9pZCA6OlxuICAgICAgICByZXR1cm4gLy8gcmVmdXNlIHRvIG92ZXJyaWRlIGV4aXN0aW5nIGVudHJpZXMgd2l0aCBtaXNtYXRjaGVkIGVjX3B1Yl9pZFxuXG4gICAgICBjb25zdCBlbnRyeSA9IE9iamVjdC5hc3NpZ24gQCB7fSwgbWV0YSwgQHt9IHN3aW1fc3RhdGUsIHN3aW1faG9zdCwgc3dpbV90czogbmV3IERhdGUoKVxuICAgICAgYnlJZC5zZXQgQCBpZF9yb3V0ZXIsIGVudHJ5XG4gICAgICBwcXVldWUoKS51cGRhdGVzLnB1c2ggQCBlbnRyeVxuXG5cbiAgcmVnaXN0ZXJSb3V0ZXJEaXNjb3ZlcnkoaHViKSA6OlxuICAgIGlmIG51bGwgPT0gaHViIDo6IGh1YiA9IHRoaXMuaHViXG5cbiAgICBjb25zdCByZXNvbHZlUm91dGVySWQgPSBhc3luYyBpZF9yb3V0ZXIgPT4gOjpcbiAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy5ieUlkLmdldChpZF9yb3V0ZXIpXG4gICAgICBpZiB1bmRlZmluZWQgPT09IGVudHJ5IDo6IHJldHVyblxuXG4gICAgICBjb25zdCBjaGFuID0gYXdhaXQgaHViLmNvbm5lY3QgQCBlbnRyeS5jaGFubmVsXG4gICAgICByZXR1cm4gY2hhbi5zZW5kUmF3XG5cbiAgICBodWIucm91dGVyLnJvdXRlRGlzY292ZXJ5LnB1c2ggQCByZXNvbHZlUm91dGVySWRcbiAgICByZXR1cm4gdGhpc1xuXG5cbiAgX3N1YnNjcmliZXJMaXN0ID0gW11cbiAgc3Vic2NyaWJlKGNhbGxiYWNrKSA6OlxuICAgIHRoaXMuX3N1YnNjcmliZXJMaXN0LnB1c2ggQCBjYWxsYmFja1xuICAgIHJldHVybiB0aGlzXG5cbnN3aW1fcGx1Z2luLlN3aW1EaXNjb3ZlcnkgPSBTd2ltRGlzY292ZXJ5XG5PYmplY3QuYXNzaWduIEAgU3dpbURpc2NvdmVyeS5wcm90b3R5cGUsIEA6XG4gIHN3aW1fc3RhdGVfbHV0OiBAW10gJ2FsaXZlJywgJ3N1c3BlY3QnLCAnZGVhZCdcbiAgcHJvbWlzZVF1ZXVlXG5cblxuZnVuY3Rpb24gc2xlZXAobXMsIGN0eCkgOjpcbiAgcmV0dXJuIG5ldyBQcm9taXNlIEAgcmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zLCBjdHgpXG5cbmZ1bmN0aW9uIHByb21pc2VRdWV1ZShuZXh0UHJvbWlzZSkgOjpcbiAgbGV0IHRpcCA9IG51bGxcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIDo6XG4gICAgaWYgbnVsbCA9PT0gdGlwIDo6XG4gICAgICB0aXAgPSBuZXh0UHJvbWlzZSgpXG4gICAgICB0aXAudGhlbiBAIGNsZWFyX3RpcFxuICAgIHJldHVybiB0aXBcblxuICBmdW5jdGlvbiBjbGVhcl90aXAoKSA6OlxuICAgIHRpcCA9IG51bGxcblxuIl0sIm5hbWVzIjpbInN3aW1fcGx1Z2luIiwiZGVmYXVsdF9vcHRpb25zIiwicGx1Z2luX29wdGlvbnMiLCJPYmplY3QiLCJhc3NpZ24iLCJodWIiLCJjcmVhdGVTV0lNIiwiYXNzaWduU1dJTU1ldGEiLCJtZXRhIiwiYXJncyIsImlkX3NlbGYiLCJpZF9yb3V0ZXIiLCJlY19wdWJfaWQiLCJyb3V0ZXIiLCJpZF9pbmZvIiwidG9TdHJpbmciLCJob3N0IiwiY2hhbm5lbCIsInN3aW1fcG9ydCIsImNvbm5faW5mbyIsImlwX3NlcnZlciIsImlwX2xvY2FsIiwiYXNVUkwiLCJhZGRyZXNzIiwiRXJyb3IiLCJzd2ltX29wdHMiLCJzd2ltX2NvbmZpZyIsImxvY2FsIiwic3dpbSIsIlNXSU0iLCJTd2ltRGlzY292ZXJ5IiwiX3N1YnNjcmliZXJMaXN0IiwiYnlJZCIsIk1hcCIsImRlZmluZVByb3BlcnRpZXMiLCJ2YWx1ZSIsIl9iaW5kU3dpbVVwZGF0ZXMiLCJsb2NhbGhvc3QiLCJzd2ltX2hvc3RzIiwiZXJyIiwiaG9zdHMiLCJtYXAiLCJib290c3RyYXAiLCJBcnJheSIsImlzQXJyYXkiLCJUeXBlRXJyb3IiLCJ1cGRhdGVQcm9wcyIsInBxdWV1ZSIsInByb21pc2VRdWV1ZSIsInVwZGF0ZXMiLCJhbnMiLCJzbGVlcCIsInN1YiIsInRoZW4iLCJvcHRzIiwic3dpbV9zdGF0ZV9sdXQiLCJzbGljZSIsIm9uIiwiZXZ0Iiwic3RhdGUiLCJfb25fdXBkYXRlRW50cnkiLCJzd2ltX3N0YXRlIiwic3dpbV9ob3N0IiwiY3VyIiwiZ2V0IiwidW5kZWZpbmVkIiwiZW50cnkiLCJzd2ltX3RzIiwiRGF0ZSIsInNldCIsInB1c2giLCJyZXNvbHZlUm91dGVySWQiLCJjaGFuIiwiY29ubmVjdCIsInNlbmRSYXciLCJyb3V0ZURpc2NvdmVyeSIsImNhbGxiYWNrIiwicHJvdG90eXBlIiwibXMiLCJjdHgiLCJQcm9taXNlIiwicmVzb2x2ZSIsInNldFRpbWVvdXQiLCJuZXh0UHJvbWlzZSIsInRpcCIsImNsZWFyX3RpcCJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUdBQSxZQUFZQyxlQUFaLEdBQThCO2FBQ2pCLElBRGlCO2VBRWY7Y0FDRCxHQURDO2lCQUVFLEdBRkY7aUJBR0UsRUFIRjtvQkFJSyxFQUpMO3NCQUtPLENBTFAsRUFGZSxFQUE5Qjs7QUFTQSxBQUFlLFNBQVNELFdBQVQsQ0FBcUJFLGNBQXJCLEVBQXFDO21CQUNqQ0MsT0FBT0MsTUFBUCxDQUFnQixFQUFoQixFQUFvQkosWUFBWUMsZUFBaEMsRUFBaURDLGNBQWpELENBQWpCOztTQUVPLFVBQVVHLEdBQVYsRUFBZTtRQUNoQkMsVUFBSixHQUFpQkEsVUFBakI7O2FBRVNDLGNBQVQsQ0FBd0JDLElBQXhCLEVBQThCLEdBQUdDLElBQWpDLEVBQXVDO1lBQy9CLEVBQUNDLFNBQVNDLFNBQVYsRUFBcUJDLFNBQXJCLEtBQWtDUCxJQUFJUSxNQUE1QztZQUNNQyxVQUFVRixZQUNaLEVBQUlELFNBQUo7bUJBQ2VDLFVBQVVHLFFBQVYsQ0FBbUIsUUFBbkIsQ0FEZixFQURZLEdBR1osRUFBSUosU0FBSixFQUhKOzthQUtPUixPQUFPQyxNQUFQLENBQWdCLEVBQWhCLEVBQW9CSSxJQUFwQixFQUEwQixHQUFHQyxJQUE3QixFQUFtQ0ssT0FBbkMsQ0FBUDs7O2FBRU9SLFVBQVQsQ0FBb0IsRUFBQ1UsSUFBRCxFQUFPUixJQUFQLEVBQWFTLE9BQWIsRUFBc0JDLFNBQXRCLEVBQXBCLEVBQXNEO1VBQ2hEQyxZQUFZLGVBQWUsT0FBT0YsT0FBdEIsR0FDWkEsT0FEWSxHQUNGQSxRQUFRRSxTQUR0QjtVQUVHQSxTQUFILEVBQWU7Y0FDUCxFQUFDQyxTQUFELEVBQVlDLFFBQVosS0FBd0JGLFdBQTlCO2tCQUNVLENBQUNDLGFBQWFDLFFBQWQsRUFBd0JDLEtBQXhCLEVBQVY7WUFDRyxDQUFFTixJQUFMLEVBQVk7Y0FDUCxD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
