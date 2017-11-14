import { resolve } from 'dns';
import SWIM from 'swim';

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
      resolve(swim_hosts, (err, hosts) => {
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

export default swim_plugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3dpbV9kaXNjb3ZlcnkubWpzIiwic291cmNlcyI6WyIuLi9jb2RlL3N3aW1fZGlzY292ZXJ5LmpzeSJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge3Jlc29sdmUgYXMgZG5zX3Jlc29sdmV9IGZyb20gJ2RucydcbmltcG9ydCBTV0lNIGZyb20gJ3N3aW0nXG5cbnN3aW1fcGx1Z2luLmRlZmF1bHRfb3B0aW9ucyA9IEB7fVxuICBzd2ltX3BvcnQ6IDI3MDBcbiAgc3dpbV9jb25maWc6IEB7fVxuICAgIGludGVydmFsOiAxMDBcbiAgICBqb2luVGltZW91dDogMzAwXG4gICAgcGluZ1RpbWVvdXQ6IDMwXG4gICAgcGluZ1JlcVRpbWVvdXQ6IDgwXG4gICAgcGluZ1JlcUdyb3VwU2l6ZTogMlxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBzd2ltX3BsdWdpbihwbHVnaW5fb3B0aW9ucykgOjpcbiAgcGx1Z2luX29wdGlvbnMgPSBPYmplY3QuYXNzaWduIEAge30sIHN3aW1fcGx1Z2luLmRlZmF1bHRfb3B0aW9ucywgcGx1Z2luX29wdGlvbnNcblxuICByZXR1cm4gZnVuY3Rpb24gKGh1YikgOjpcbiAgICBodWIuY3JlYXRlU1dJTSA9IGNyZWF0ZVNXSU1cblxuICAgIGZ1bmN0aW9uIGFzc2lnblNXSU1NZXRhKG1ldGEsIC4uLmFyZ3MpIDo6XG4gICAgICBjb25zdCB7aWRfc2VsZjogaWRfcm91dGVyLCBlY19wdWJfaWR9ID0gaHViLnJvdXRlclxuICAgICAgY29uc3QgaWRfaW5mbyA9IGVjX3B1Yl9pZCBcbiAgICAgICAgPyBAe30gaWRfcm91dGVyXG4gICAgICAgICAgICAgIGVjX3B1Yl9pZDogZWNfcHViX2lkLnRvU3RyaW5nKCdiYXNlNjQnKVxuICAgICAgICA6IEB7fSBpZF9yb3V0ZXJcblxuICAgICAgcmV0dXJuIE9iamVjdC5hc3NpZ24gQCB7fSwgbWV0YSwgLi4uYXJncywgaWRfaW5mb1xuXG4gICAgZnVuY3Rpb24gY3JlYXRlU1dJTSh7aG9zdCwgbWV0YSwgY2hhbm5lbCwgc3dpbV9wb3J0fSkgOjpcbiAgICAgIGxldCBjb25uX2luZm8gPSAnZnVuY3Rpb24nID09PSB0eXBlb2YgY2hhbm5lbCBcbiAgICAgICAgPyBjaGFubmVsIDogY2hhbm5lbC5jb25uX2luZm9cbiAgICAgIGlmIGNvbm5faW5mbyA6OlxuICAgICAgICBjb25zdCB7aXBfc2VydmVyLCBpcF9sb2NhbH0gPSBjb25uX2luZm8oKVxuICAgICAgICBjaGFubmVsID0gKGlwX3NlcnZlciB8fCBpcF9sb2NhbCkuYXNVUkwoKVxuICAgICAgICBpZiAhIGhvc3QgOjpcbiAgICAgICAgICBpZiAhIHN3aW1fcG9ydCA6OiBzd2ltX3BvcnQgPSBwbHVnaW5fb3B0aW9ucy5zd2ltX3BvcnRcbiAgICAgICAgICBob3N0ID0gYCR7KGlwX3NlcnZlciB8fCBpcF9sb2NhbCkuYWRkcmVzc306JHtzd2ltX3BvcnR9YFxuXG4gICAgICBpZiAhIGhvc3QgOjpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIEAgYFNXSU0gcGFja2FnZSByZXF1aXJlcyBhIHZhbGlkIFwiaG9zdFwiIHBhcmFtZXRlcmBcblxuICAgICAgbWV0YSA9IGFzc2lnblNXSU1NZXRhIEAgbWV0YSwgY2hhbm5lbCAmJiBAe30gY2hhbm5lbFxuICAgICAgY29uc3Qgc3dpbV9vcHRzID0gT2JqZWN0LmFzc2lnbiBAXG4gICAgICAgIHt9LCBwbHVnaW5fb3B0aW9ucy5zd2ltX2NvbmZpZ1xuICAgICAgICBAOiBsb2NhbDogQHt9IGhvc3QsIG1ldGFcblxuICAgICAgY29uc3Qgc3dpbSA9IG5ldyBTV0lNIEAgc3dpbV9vcHRzXG4gICAgICByZXR1cm4gbmV3IHN3aW1fcGx1Z2luLlN3aW1EaXNjb3ZlcnkgQCBodWIsIHN3aW1cblxuXG5cbmNsYXNzIFN3aW1EaXNjb3ZlcnkgOjpcbiAgY29uc3RydWN0b3IoaHViLCBzd2ltKSA6OlxuICAgIGNvbnN0IGJ5SWQgPSBuZXcgTWFwKClcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyBAIHRoaXMsIEA6XG4gICAgICBodWI6IEA6IHZhbHVlOiBodWJcbiAgICAgIHN3aW06IEA6IHZhbHVlOiBzd2ltXG4gICAgICBieUlkOiBAOiB2YWx1ZTogYnlJZFxuXG4gICAgdGhpcy5fYmluZFN3aW1VcGRhdGVzKHN3aW0sIGJ5SWQpXG5cbiAgbG9jYWxob3N0KCkgOjogcmV0dXJuIHRoaXMuc3dpbS5sb2NhbGhvc3QoKVxuXG4gIGJvb3RzdHJhcChzd2ltX2hvc3RzPVtdLCBzd2ltX3BvcnQpIDo6XG4gICAgY29uc3Qgc3dpbSA9IHRoaXMuc3dpbVxuICAgIGlmICdzdHJpbmcnID09PSB0eXBlb2Ygc3dpbV9ob3N0cyA6OlxuICAgICAgZG5zX3Jlc29sdmUgQCBzd2ltX2hvc3RzLCAoZXJyLCBob3N0cykgPT4gOjpcbiAgICAgICAgc3dpbV9ob3N0cyA9IGhvc3RzLm1hcCBAIGhvc3QgPT4gYCR7aG9zdH06JHtzd2ltX3BvcnR9YFxuICAgICAgICBzd2ltLmJvb3RzdHJhcCBAIHN3aW1faG9zdHNcbiAgICAgIHJldHVybiB0aGlzXG5cbiAgICBlbHNlIGlmIEFycmF5LmlzQXJyYXkgQCBzd2ltX2hvc3RzIDo6XG4gICAgICBpZiBzd2ltX3BvcnQgOjpcbiAgICAgICAgc3dpbV9ob3N0cyA9IHN3aW1faG9zdHMubWFwIEAgaG9zdCA9PiBgJHtob3N0fToke3N3aW1fcG9ydH1gXG4gICAgICBzd2ltLmJvb3RzdHJhcCBAIHN3aW1faG9zdHNcbiAgICAgIHJldHVybiB0aGlzXG5cbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yIEAgYFVuZXhwZWN0ZWQgJ3N3aW1faG9zdHMnIHBhcmFtZXRlciBmb3JtYXQuYFxuXG5cbiAgX2JpbmRTd2ltVXBkYXRlcyhzd2ltLCBieUlkKSA6OlxuICAgIGNvbnN0IHVwZGF0ZVByb3BzID0gQHt9IGJ5SWQ6IEA6IHZhbHVlOiBieUlkXG4gICAgY29uc3QgcHF1ZXVlID0gdGhpcy5wcm9taXNlUXVldWUgQCAoKSA9PiA6OlxuICAgICAgY29uc3QgdXBkYXRlcyA9IE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzIEAgW10sIHVwZGF0ZVByb3BzXG4gICAgICBjb25zdCBhbnMgPSBzbGVlcCgwLCB1cGRhdGVzKVxuICAgICAgYW5zLnVwZGF0ZXMgPSB1cGRhdGVzXG4gICAgICBmb3IgY29uc3Qgc3ViIG9mIHRoaXMuX3N1YnNjcmliZXJMaXN0IDo6XG4gICAgICAgIGFucy50aGVuKHN1YilcbiAgICAgIHJldHVybiBhbnNcblxuICAgIDo6XG4gICAgICBjb25zdCB7aG9zdCwgbWV0YX0gPSBzd2ltLm9wdHMubG9jYWxcbiAgICAgIF9vbl91cGRhdGVFbnRyeSBAIG1ldGEsICdzZWxmJywgaG9zdFxuXG4gICAgOjpcbiAgICAgIGNvbnN0IHN3aW1fc3RhdGVfbHV0ID0gdGhpcy5zd2ltX3N0YXRlX2x1dC5zbGljZSgpXG4gICAgICBzd2ltLm9uIEAgJ3VwZGF0ZScsIGV2dCA9PiA6OlxuICAgICAgICBfb25fdXBkYXRlRW50cnkgQCBldnQubWV0YSwgc3dpbV9zdGF0ZV9sdXRbZXZ0LnN0YXRlXSwgZXZ0Lmhvc3RcblxuICAgIGZ1bmN0aW9uIF9vbl91cGRhdGVFbnRyeShtZXRhLCBzd2ltX3N0YXRlLCBzd2ltX2hvc3QpIDo6XG4gICAgICBjb25zdCB7aWRfcm91dGVyLCBlY19wdWJfaWR9ID0gbWV0YVxuICAgICAgY29uc3QgY3VyID0gYnlJZC5nZXQoaWRfcm91dGVyKVxuICAgICAgaWYgdW5kZWZpbmVkICE9PSBjdXIgJiYgZWNfcHViX2lkICE9IGN1ci5lY19wdWJfaWQgOjpcbiAgICAgICAgcmV0dXJuIC8vIHJlZnVzZSB0byBvdmVycmlkZSBleGlzdGluZyBlbnRyaWVzIHdpdGggbWlzbWF0Y2hlZCBlY19wdWJfaWRcblxuICAgICAgY29uc3QgZW50cnkgPSBPYmplY3QuYXNzaWduIEAge30sIG1ldGEsIEB7fSBzd2ltX3N0YXRlLCBzd2ltX2hvc3QsIHN3aW1fdHM6IG5ldyBEYXRlKClcbiAgICAgIGJ5SWQuc2V0IEAgaWRfcm91dGVyLCBlbnRyeVxuICAgICAgcHF1ZXVlKCkudXBkYXRlcy5wdXNoIEAgZW50cnlcblxuXG4gIHJlZ2lzdGVyUm91dGVyRGlzY292ZXJ5KGh1YikgOjpcbiAgICBpZiBudWxsID09IGh1YiA6OiBodWIgPSB0aGlzLmh1YlxuXG4gICAgY29uc3QgcmVzb2x2ZVJvdXRlcklkID0gYXN5bmMgaWRfcm91dGVyID0+IDo6XG4gICAgICBjb25zdCBlbnRyeSA9IHRoaXMuYnlJZC5nZXQoaWRfcm91dGVyKVxuICAgICAgaWYgdW5kZWZpbmVkID09PSBlbnRyeSA6OiByZXR1cm5cblxuICAgICAgY29uc3QgY2hhbiA9IGF3YWl0IGh1Yi5jb25uZWN0IEAgZW50cnkuY2hhbm5lbFxuICAgICAgcmV0dXJuIGNoYW4uc2VuZFJhd1xuXG4gICAgaHViLnJvdXRlci5yb3V0ZURpc2NvdmVyeS5wdXNoIEAgcmVzb2x2ZVJvdXRlcklkXG4gICAgcmV0dXJuIHRoaXNcblxuXG4gIF9zdWJzY3JpYmVyTGlzdCA9IFtdXG4gIHN1YnNjcmliZShjYWxsYmFjaykgOjpcbiAgICB0aGlzLl9zdWJzY3JpYmVyTGlzdC5wdXNoIEAgY2FsbGJhY2tcbiAgICByZXR1cm4gdGhpc1xuXG5zd2ltX3BsdWdpbi5Td2ltRGlzY292ZXJ5ID0gU3dpbURpc2NvdmVyeVxuT2JqZWN0LmFzc2lnbiBAIFN3aW1EaXNjb3ZlcnkucHJvdG90eXBlLCBAOlxuICBzd2ltX3N0YXRlX2x1dDogQFtdICdhbGl2ZScsICdzdXNwZWN0JywgJ2RlYWQnXG4gIHByb21pc2VRdWV1ZVxuXG5cbmZ1bmN0aW9uIHNsZWVwKG1zLCBjdHgpIDo6XG4gIHJldHVybiBuZXcgUHJvbWlzZSBAIHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcywgY3R4KVxuXG5mdW5jdGlvbiBwcm9taXNlUXVldWUobmV4dFByb21pc2UpIDo6XG4gIGxldCB0aXAgPSBudWxsXG4gIHJldHVybiBmdW5jdGlvbiAoKSA6OlxuICAgIGlmIG51bGwgPT09IHRpcCA6OlxuICAgICAgdGlwID0gbmV4dFByb21pc2UoKVxuICAgICAgdGlwLnRoZW4gQCBjbGVhcl90aXBcbiAgICByZXR1cm4gdGlwXG5cbiAgZnVuY3Rpb24gY2xlYXJfdGlwKCkgOjpcbiAgICB0aXAgPSBudWxsXG5cbiJdLCJuYW1lcyI6WyJzd2ltX3BsdWdpbiIsImRlZmF1bHRfb3B0aW9ucyIsInBsdWdpbl9vcHRpb25zIiwiT2JqZWN0IiwiYXNzaWduIiwiaHViIiwiY3JlYXRlU1dJTSIsImFzc2lnblNXSU1NZXRhIiwibWV0YSIsImFyZ3MiLCJpZF9zZWxmIiwiaWRfcm91dGVyIiwiZWNfcHViX2lkIiwicm91dGVyIiwiaWRfaW5mbyIsInRvU3RyaW5nIiwiaG9zdCIsImNoYW5uZWwiLCJzd2ltX3BvcnQiLCJjb25uX2luZm8iLCJpcF9zZXJ2ZXIiLCJpcF9sb2NhbCIsImFzVVJMIiwiYWRkcmVzcyIsIkVycm9yIiwic3dpbV9vcHRzIiwic3dpbV9jb25maWciLCJsb2NhbCIsInN3aW0iLCJTV0lNIiwiU3dpbURpc2NvdmVyeSIsIl9zdWJzY3JpYmVyTGlzdCIsImJ5SWQiLCJNYXAiLCJkZWZpbmVQcm9wZXJ0aWVzIiwidmFsdWUiLCJfYmluZFN3aW1VcGRhdGVzIiwibG9jYWxob3N0Iiwic3dpbV9ob3N0cyIsImVyciIsImhvc3RzIiwibWFwIiwiYm9vdHN0cmFwIiwiQXJyYXkiLCJpc0FycmF5IiwiVHlwZUVycm9yIiwidXBkYXRlUHJvcHMiLCJwcXVldWUiLCJwcm9taXNlUXVldWUiLCJ1cGRhdGVzIiwiYW5zIiwic2xlZXAiLCJzdWIiLCJ0aGVuIiwib3B0cyIsInN3aW1fc3RhdGVfbHV0Iiwic2xpY2UiLCJvbiIsImV2dCIsInN0YXRlIiwiX29uX3VwZGF0ZUVudHJ5Iiwic3dpbV9zdGF0ZSIsInN3aW1faG9zdCIsImN1ciIsImdldCIsInVuZGVmaW5lZCIsImVudHJ5Iiwic3dpbV90cyIsIkRhdGUiLCJzZXQiLCJwdXNoIiwicmVzb2x2ZVJvdXRlcklkIiwiY2hhbiIsImNvbm5lY3QiLCJzZW5kUmF3Iiwicm91dGVEaXNjb3ZlcnkiLCJjYWxsYmFjayIsInByb3RvdHlwZSIsIm1zIiwiY3R4IiwiUHJvbWlzZSIsInJlc29sdmUiLCJzZXRUaW1lb3V0IiwibmV4dFByb21pc2UiLCJ0aXAiLCJjbGVhcl90aXAiXSwibWFwcGluZ3MiOiI7OztBQUdBQSxZQUFZQyxlQUFaLEdBQThCO2FBQ2pCLElBRGlCO2VBRWY7Y0FDRCxHQURDO2lCQUVFLEdBRkY7aUJBR0UsRUFIRjtvQkFJSyxFQUpMO3NCQUtPLENBTFAsRUFGZSxFQUE5Qjs7QUFTQSxBQUFlLFNBQVNELFdBQVQsQ0FBcUJFLGNBQXJCLEVBQXFDO21CQUNqQ0MsT0FBT0MsTUFBUCxDQUFnQixFQUFoQixFQUFvQkosWUFBWUMsZUFBaEMsRUFBaURDLGNBQWpELENBQWpCOztTQUVPLFVBQVVHLEdBQVYsRUFBZTtRQUNoQkMsVUFBSixHQUFpQkEsVUFBakI7O2FBRVNDLGNBQVQsQ0FBd0JDLElBQXhCLEVBQThCLEdBQUdDLElBQWpDLEVBQXVDO1lBQy9CLEVBQUNDLFNBQVNDLFNBQVYsRUFBcUJDLFNBQXJCLEtBQWtDUCxJQUFJUSxNQUE1QztZQUNNQyxVQUFVRixZQUNaLEVBQUlELFNBQUo7bUJBQ2VDLFVBQVVHLFFBQVYsQ0FBbUIsUUFBbkIsQ0FEZixFQURZLEdBR1osRUFBSUosU0FBSixFQUhKOzthQUtPUixPQUFPQyxNQUFQLENBQWdCLEVBQWhCLEVBQW9CSSxJQUFwQixFQUEwQixHQUFHQyxJQUE3QixFQUFtQ0ssT0FBbkMsQ0FBUDs7O2FBRU9SLFVBQVQsQ0FBb0IsRUFBQ1UsSUFBRCxFQUFPUixJQUFQLEVBQWFTLE9BQWIsRUFBc0JDLFNBQXRCLEVBQXBCLEVBQXNEO1VBQ2hEQyxZQUFZLGVBQWUsT0FBT0YsT0FBdEIsR0FDWkEsT0FEWSxHQUNGQSxRQUFRRSxTQUR0QjtVQUVHQSxTQUFILEVBQWU7Y0FDUCxFQUFDQyxTQUFELEVBQVlDLFFBQVosS0FBd0JGLFdBQTlCO2tCQUNVLENBQUNDLGFBQWFDLFFBQWQsRUFBd0JDLEtBQXhCLEVBQVY7WUFDRyxDQUFFTixJQUFMLEVBQVk7Y0FDUCxDQUFF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
