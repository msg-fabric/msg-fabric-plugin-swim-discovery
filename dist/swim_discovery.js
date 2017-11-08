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

    hub.router._routeDiscovery.push(resolveRouterId);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3dpbV9kaXNjb3ZlcnkuanMiLCJzb3VyY2VzIjpbIi4uL2NvZGUvc3dpbV9kaXNjb3ZlcnkuanN5Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7cmVzb2x2ZSBhcyBkbnNfcmVzb2x2ZX0gZnJvbSAnZG5zJ1xuaW1wb3J0IFNXSU0gZnJvbSAnc3dpbSdcblxuc3dpbV9wbHVnaW4uZGVmYXVsdF9vcHRpb25zID0gQHt9XG4gIHN3aW1fcG9ydDogMjcwMFxuICBzd2ltX2NvbmZpZzogQHt9XG4gICAgaW50ZXJ2YWw6IDEwMFxuICAgIGpvaW5UaW1lb3V0OiAzMDBcbiAgICBwaW5nVGltZW91dDogMzBcbiAgICBwaW5nUmVxVGltZW91dDogODBcbiAgICBwaW5nUmVxR3JvdXBTaXplOiAyXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHN3aW1fcGx1Z2luKHBsdWdpbl9vcHRpb25zKSA6OlxuICBwbHVnaW5fb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24gQCB7fSwgc3dpbV9wbHVnaW4uZGVmYXVsdF9vcHRpb25zLCBwbHVnaW5fb3B0aW9uc1xuXG4gIHJldHVybiBmdW5jdGlvbiAoaHViKSA6OlxuICAgIGh1Yi5jcmVhdGVTV0lNID0gY3JlYXRlU1dJTVxuXG4gICAgZnVuY3Rpb24gYXNzaWduU1dJTU1ldGEobWV0YSwgLi4uYXJncykgOjpcbiAgICAgIGNvbnN0IHtpZF9zZWxmOiBpZF9yb3V0ZXIsIGVjX3B1Yl9pZH0gPSBodWIucm91dGVyXG4gICAgICBjb25zdCBpZF9pbmZvID0gZWNfcHViX2lkIFxuICAgICAgICA/IEB7fSBpZF9yb3V0ZXJcbiAgICAgICAgICAgICAgZWNfcHViX2lkOiBlY19wdWJfaWQudG9TdHJpbmcoJ2Jhc2U2NCcpXG4gICAgICAgIDogQHt9IGlkX3JvdXRlclxuXG4gICAgICByZXR1cm4gT2JqZWN0LmFzc2lnbiBAIHt9LCBtZXRhLCAuLi5hcmdzLCBpZF9pbmZvXG5cbiAgICBmdW5jdGlvbiBjcmVhdGVTV0lNKHtob3N0LCBtZXRhLCBjaGFubmVsLCBzd2ltX3BvcnR9KSA6OlxuICAgICAgbGV0IGNvbm5faW5mbyA9ICdmdW5jdGlvbicgPT09IHR5cGVvZiBjaGFubmVsIFxuICAgICAgICA/IGNoYW5uZWwgOiBjaGFubmVsLmNvbm5faW5mb1xuICAgICAgaWYgY29ubl9pbmZvIDo6XG4gICAgICAgIGNvbnN0IHtpcF9zZXJ2ZXIsIGlwX2xvY2FsfSA9IGNvbm5faW5mbygpXG4gICAgICAgIGNoYW5uZWwgPSAoaXBfc2VydmVyIHx8IGlwX2xvY2FsKS5hc1VSTCgpXG4gICAgICAgIGlmICEgaG9zdCA6OlxuICAgICAgICAgIGlmICEgc3dpbV9wb3J0IDo6IHN3aW1fcG9ydCA9IHBsdWdpbl9vcHRpb25zLnN3aW1fcG9ydFxuICAgICAgICAgIGhvc3QgPSBgJHsoaXBfc2VydmVyIHx8IGlwX2xvY2FsKS5hZGRyZXNzfToke3N3aW1fcG9ydH1gXG5cbiAgICAgIGlmICEgaG9zdCA6OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgQCBgU1dJTSBwYWNrYWdlIHJlcXVpcmVzIGEgdmFsaWQgXCJob3N0XCIgcGFyYW1ldGVyYFxuXG4gICAgICBtZXRhID0gYXNzaWduU1dJTU1ldGEgQCBtZXRhLCBjaGFubmVsICYmIEB7fSBjaGFubmVsXG4gICAgICBjb25zdCBzd2ltX29wdHMgPSBPYmplY3QuYXNzaWduIEBcbiAgICAgICAge30sIHBsdWdpbl9vcHRpb25zLnN3aW1fY29uZmlnXG4gICAgICAgIEA6IGxvY2FsOiBAe30gaG9zdCwgbWV0YVxuXG4gICAgICBjb25zdCBzd2ltID0gbmV3IFNXSU0gQCBzd2ltX29wdHNcbiAgICAgIHJldHVybiBuZXcgc3dpbV9wbHVnaW4uU3dpbURpc2NvdmVyeSBAIGh1Yiwgc3dpbVxuXG5cblxuY2xhc3MgU3dpbURpc2NvdmVyeSA6OlxuICBjb25zdHJ1Y3RvcihodWIsIHN3aW0pIDo6XG4gICAgY29uc3QgYnlJZCA9IG5ldyBNYXAoKVxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzIEAgdGhpcywgQDpcbiAgICAgIGh1YjogQDogdmFsdWU6IGh1YlxuICAgICAgc3dpbTogQDogdmFsdWU6IHN3aW1cbiAgICAgIGJ5SWQ6IEA6IHZhbHVlOiBieUlkXG5cbiAgICB0aGlzLl9iaW5kU3dpbVVwZGF0ZXMoc3dpbSwgYnlJZClcblxuICBsb2NhbGhvc3QoKSA6OiByZXR1cm4gdGhpcy5zd2ltLmxvY2FsaG9zdCgpXG5cbiAgYm9vdHN0cmFwKHN3aW1faG9zdHM9W10sIHN3aW1fcG9ydCkgOjpcbiAgICBjb25zdCBzd2ltID0gdGhpcy5zd2ltXG4gICAgaWYgJ3N0cmluZycgPT09IHR5cGVvZiBzd2ltX2hvc3RzIDo6XG4gICAgICBkbnNfcmVzb2x2ZSBAIHN3aW1faG9zdHMsIChlcnIsIGhvc3RzKSA9PiA6OlxuICAgICAgICBzd2ltX2hvc3RzID0gaG9zdHMubWFwIEAgaG9zdCA9PiBgJHtob3N0fToke3N3aW1fcG9ydH1gXG4gICAgICAgIHN3aW0uYm9vdHN0cmFwIEAgc3dpbV9ob3N0c1xuICAgICAgcmV0dXJuIHRoaXNcblxuICAgIGVsc2UgaWYgQXJyYXkuaXNBcnJheSBAIHN3aW1faG9zdHMgOjpcbiAgICAgIGlmIHN3aW1fcG9ydCA6OlxuICAgICAgICBzd2ltX2hvc3RzID0gc3dpbV9ob3N0cy5tYXAgQCBob3N0ID0+IGAke2hvc3R9OiR7c3dpbV9wb3J0fWBcbiAgICAgIHN3aW0uYm9vdHN0cmFwIEAgc3dpbV9ob3N0c1xuICAgICAgcmV0dXJuIHRoaXNcblxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IgQCBgVW5leHBlY3RlZCAnc3dpbV9ob3N0cycgcGFyYW1ldGVyIGZvcm1hdC5gXG5cblxuICBfYmluZFN3aW1VcGRhdGVzKHN3aW0sIGJ5SWQpIDo6XG4gICAgY29uc3QgdXBkYXRlUHJvcHMgPSBAe30gYnlJZDogQDogdmFsdWU6IGJ5SWRcbiAgICBjb25zdCBwcXVldWUgPSB0aGlzLnByb21pc2VRdWV1ZSBAICgpID0+IDo6XG4gICAgICBjb25zdCB1cGRhdGVzID0gT2JqZWN0LmRlZmluZVByb3BlcnRpZXMgQCBbXSwgdXBkYXRlUHJvcHNcbiAgICAgIGNvbnN0IGFucyA9IHNsZWVwKDAsIHVwZGF0ZXMpXG4gICAgICBhbnMudXBkYXRlcyA9IHVwZGF0ZXNcbiAgICAgIGZvciBjb25zdCBzdWIgb2YgdGhpcy5fc3Vic2NyaWJlckxpc3QgOjpcbiAgICAgICAgYW5zLnRoZW4oc3ViKVxuICAgICAgcmV0dXJuIGFuc1xuXG4gICAgOjpcbiAgICAgIGNvbnN0IHtob3N0LCBtZXRhfSA9IHN3aW0ub3B0cy5sb2NhbFxuICAgICAgX29uX3VwZGF0ZUVudHJ5IEAgbWV0YSwgJ3NlbGYnLCBob3N0XG5cbiAgICA6OlxuICAgICAgY29uc3Qgc3dpbV9zdGF0ZV9sdXQgPSB0aGlzLnN3aW1fc3RhdGVfbHV0LnNsaWNlKClcbiAgICAgIHN3aW0ub24gQCAndXBkYXRlJywgZXZ0ID0+IDo6XG4gICAgICAgIF9vbl91cGRhdGVFbnRyeSBAIGV2dC5tZXRhLCBzd2ltX3N0YXRlX2x1dFtldnQuc3RhdGVdLCBldnQuaG9zdFxuXG4gICAgZnVuY3Rpb24gX29uX3VwZGF0ZUVudHJ5KG1ldGEsIHN3aW1fc3RhdGUsIHN3aW1faG9zdCkgOjpcbiAgICAgIGNvbnN0IHtpZF9yb3V0ZXIsIGVjX3B1Yl9pZH0gPSBtZXRhXG4gICAgICBjb25zdCBjdXIgPSBieUlkLmdldChpZF9yb3V0ZXIpXG4gICAgICBpZiB1bmRlZmluZWQgIT09IGN1ciAmJiBlY19wdWJfaWQgIT0gY3VyLmVjX3B1Yl9pZCA6OlxuICAgICAgICByZXR1cm4gLy8gcmVmdXNlIHRvIG92ZXJyaWRlIGV4aXN0aW5nIGVudHJpZXMgd2l0aCBtaXNtYXRjaGVkIGVjX3B1Yl9pZFxuXG4gICAgICBjb25zdCBlbnRyeSA9IE9iamVjdC5hc3NpZ24gQCB7fSwgbWV0YSwgQHt9IHN3aW1fc3RhdGUsIHN3aW1faG9zdCwgc3dpbV90czogbmV3IERhdGUoKVxuICAgICAgYnlJZC5zZXQgQCBpZF9yb3V0ZXIsIGVudHJ5XG4gICAgICBwcXVldWUoKS51cGRhdGVzLnB1c2ggQCBlbnRyeVxuXG5cbiAgcmVnaXN0ZXJSb3V0ZXJEaXNjb3ZlcnkoaHViKSA6OlxuICAgIGlmIG51bGwgPT0gaHViIDo6IGh1YiA9IHRoaXMuaHViXG5cbiAgICBjb25zdCByZXNvbHZlUm91dGVySWQgPSBhc3luYyBpZF9yb3V0ZXIgPT4gOjpcbiAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy5ieUlkLmdldChpZF9yb3V0ZXIpXG4gICAgICBpZiB1bmRlZmluZWQgPT09IGVudHJ5IDo6IHJldHVyblxuXG4gICAgICBjb25zdCBjaGFuID0gYXdhaXQgaHViLmNvbm5lY3QgQCBlbnRyeS5jaGFubmVsXG4gICAgICByZXR1cm4gY2hhbi5zZW5kUmF3XG5cbiAgICBodWIucm91dGVyLl9yb3V0ZURpc2NvdmVyeS5wdXNoIEAgcmVzb2x2ZVJvdXRlcklkXG4gICAgcmV0dXJuIHRoaXNcblxuXG4gIF9zdWJzY3JpYmVyTGlzdCA9IFtdXG4gIHN1YnNjcmliZShjYWxsYmFjaykgOjpcbiAgICB0aGlzLl9zdWJzY3JpYmVyTGlzdC5wdXNoIEAgY2FsbGJhY2tcbiAgICByZXR1cm4gdGhpc1xuXG5zd2ltX3BsdWdpbi5Td2ltRGlzY292ZXJ5ID0gU3dpbURpc2NvdmVyeVxuT2JqZWN0LmFzc2lnbiBAIFN3aW1EaXNjb3ZlcnkucHJvdG90eXBlLCBAOlxuICBzd2ltX3N0YXRlX2x1dDogQFtdICdhbGl2ZScsICdzdXNwZWN0JywgJ2RlYWQnXG4gIHByb21pc2VRdWV1ZVxuXG5cbmZ1bmN0aW9uIHNsZWVwKG1zLCBjdHgpIDo6XG4gIHJldHVybiBuZXcgUHJvbWlzZSBAIHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcywgY3R4KVxuXG5mdW5jdGlvbiBwcm9taXNlUXVldWUobmV4dFByb21pc2UpIDo6XG4gIGxldCB0aXAgPSBudWxsXG4gIHJldHVybiBmdW5jdGlvbiAoKSA6OlxuICAgIGlmIG51bGwgPT09IHRpcCA6OlxuICAgICAgdGlwID0gbmV4dFByb21pc2UoKVxuICAgICAgdGlwLnRoZW4gQCBjbGVhcl90aXBcbiAgICByZXR1cm4gdGlwXG5cbiAgZnVuY3Rpb24gY2xlYXJfdGlwKCkgOjpcbiAgICB0aXAgPSBudWxsXG5cbiJdLCJuYW1lcyI6WyJzd2ltX3BsdWdpbiIsImRlZmF1bHRfb3B0aW9ucyIsInBsdWdpbl9vcHRpb25zIiwiT2JqZWN0IiwiYXNzaWduIiwiaHViIiwiY3JlYXRlU1dJTSIsImFzc2lnblNXSU1NZXRhIiwibWV0YSIsImFyZ3MiLCJpZF9zZWxmIiwiaWRfcm91dGVyIiwiZWNfcHViX2lkIiwicm91dGVyIiwiaWRfaW5mbyIsInRvU3RyaW5nIiwiaG9zdCIsImNoYW5uZWwiLCJzd2ltX3BvcnQiLCJjb25uX2luZm8iLCJpcF9zZXJ2ZXIiLCJpcF9sb2NhbCIsImFzVVJMIiwiYWRkcmVzcyIsIkVycm9yIiwic3dpbV9vcHRzIiwic3dpbV9jb25maWciLCJsb2NhbCIsInN3aW0iLCJTV0lNIiwiU3dpbURpc2NvdmVyeSIsIl9zdWJzY3JpYmVyTGlzdCIsImJ5SWQiLCJNYXAiLCJkZWZpbmVQcm9wZXJ0aWVzIiwidmFsdWUiLCJfYmluZFN3aW1VcGRhdGVzIiwibG9jYWxob3N0Iiwic3dpbV9ob3N0cyIsImVyciIsImhvc3RzIiwibWFwIiwiYm9vdHN0cmFwIiwiQXJyYXkiLCJpc0FycmF5IiwiVHlwZUVycm9yIiwidXBkYXRlUHJvcHMiLCJwcXVldWUiLCJwcm9taXNlUXVldWUiLCJ1cGRhdGVzIiwiYW5zIiwic2xlZXAiLCJzdWIiLCJ0aGVuIiwib3B0cyIsInN3aW1fc3RhdGVfbHV0Iiwic2xpY2UiLCJvbiIsImV2dCIsInN0YXRlIiwiX29uX3VwZGF0ZUVudHJ5Iiwic3dpbV9zdGF0ZSIsInN3aW1faG9zdCIsImN1ciIsImdldCIsInVuZGVmaW5lZCIsImVudHJ5Iiwic3dpbV90cyIsIkRhdGUiLCJzZXQiLCJwdXNoIiwicmVzb2x2ZVJvdXRlcklkIiwiY2hhbiIsImNvbm5lY3QiLCJzZW5kUmF3IiwiX3JvdXRlRGlzY292ZXJ5IiwiY2FsbGJhY2siLCJwcm90b3R5cGUiLCJtcyIsImN0eCIsIlByb21pc2UiLCJyZXNvbHZlIiwic2V0VGltZW91dCIsIm5leHRQcm9taXNlIiwidGlwIiwiY2xlYXJfdGlwIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBR0FBLFlBQVlDLGVBQVosR0FBOEI7YUFDakIsSUFEaUI7ZUFFZjtjQUNELEdBREM7aUJBRUUsR0FGRjtpQkFHRSxFQUhGO29CQUlLLEVBSkw7c0JBS08sQ0FMUCxFQUZlLEVBQTlCOztBQVNBLEFBQWUsU0FBU0QsV0FBVCxDQUFxQkUsY0FBckIsRUFBcUM7bUJBQ2pDQyxPQUFPQyxNQUFQLENBQWdCLEVBQWhCLEVBQW9CSixZQUFZQyxlQUFoQyxFQUFpREMsY0FBakQsQ0FBakI7O1NBRU8sVUFBVUcsR0FBVixFQUFlO1FBQ2hCQyxVQUFKLEdBQWlCQSxVQUFqQjs7YUFFU0MsY0FBVCxDQUF3QkMsSUFBeEIsRUFBOEIsR0FBR0MsSUFBakMsRUFBdUM7WUFDL0IsRUFBQ0MsU0FBU0MsU0FBVixFQUFxQkMsU0FBckIsS0FBa0NQLElBQUlRLE1BQTVDO1lBQ01DLFVBQVVGLFlBQ1osRUFBSUQsU0FBSjttQkFDZUMsVUFBVUcsUUFBVixDQUFtQixRQUFuQixDQURmLEVBRFksR0FHWixFQUFJSixTQUFKLEVBSEo7O2FBS09SLE9BQU9DLE1BQVAsQ0FBZ0IsRUFBaEIsRUFBb0JJLElBQXBCLEVBQTBCLEdBQUdDLElBQTdCLEVBQW1DSyxPQUFuQyxDQUFQOzs7YUFFT1IsVUFBVCxDQUFvQixFQUFDVSxJQUFELEVBQU9SLElBQVAsRUFBYVMsT0FBYixFQUFzQkMsU0FBdEIsRUFBcEIsRUFBc0Q7VUFDaERDLFlBQVksZUFBZSxPQUFPRixPQUF0QixHQUNaQSxPQURZLEdBQ0ZBLFFBQVFFLFNBRHRCO1VBRUdBLFNBQUgsRUFBZTtjQUNQLEVBQUNDLFNBQUQsRUFBWUMsUUFBWixLQUF3QkYsV0FBOUI7a0JBQ1UsQ0FBQ0MsYUFBYUMsUUFBZCxFQUF3QkMsS0FBeEIsRUFBVjtZQUNHLENBQUVOLElBQUwsRUFBWTtjQUNQ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
