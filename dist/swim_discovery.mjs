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

export default swim_plugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3dpbV9kaXNjb3ZlcnkubWpzIiwic291cmNlcyI6WyIuLi9jb2RlL3N3aW1fZGlzY292ZXJ5LmpzeSJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge3Jlc29sdmUgYXMgZG5zX3Jlc29sdmV9IGZyb20gJ2RucydcbmltcG9ydCBTV0lNIGZyb20gJ3N3aW0nXG5cbnN3aW1fcGx1Z2luLmRlZmF1bHRfb3B0aW9ucyA9IEB7fVxuICBzd2ltX3BvcnQ6IDI3MDBcbiAgc3dpbV9jb25maWc6IEB7fVxuICAgIGludGVydmFsOiAxMDBcbiAgICBqb2luVGltZW91dDogMzAwXG4gICAgcGluZ1RpbWVvdXQ6IDMwXG4gICAgcGluZ1JlcVRpbWVvdXQ6IDgwXG4gICAgcGluZ1JlcUdyb3VwU2l6ZTogMlxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBzd2ltX3BsdWdpbihwbHVnaW5fb3B0aW9ucykgOjpcbiAgcGx1Z2luX29wdGlvbnMgPSBPYmplY3QuYXNzaWduIEAge30sIHN3aW1fcGx1Z2luLmRlZmF1bHRfb3B0aW9ucywgcGx1Z2luX29wdGlvbnNcblxuICByZXR1cm4gZnVuY3Rpb24gKGh1YikgOjpcbiAgICBodWIuY3JlYXRlU1dJTSA9IGNyZWF0ZVNXSU1cblxuICAgIGZ1bmN0aW9uIGFzc2lnblNXSU1NZXRhKG1ldGEsIC4uLmFyZ3MpIDo6XG4gICAgICBjb25zdCB7aWRfc2VsZjogaWRfcm91dGVyLCBlY19wdWJfaWR9ID0gaHViLnJvdXRlclxuICAgICAgY29uc3QgaWRfaW5mbyA9IGVjX3B1Yl9pZCBcbiAgICAgICAgPyBAe30gaWRfcm91dGVyXG4gICAgICAgICAgICAgIGVjX3B1Yl9pZDogZWNfcHViX2lkLnRvU3RyaW5nKCdiYXNlNjQnKVxuICAgICAgICA6IEB7fSBpZF9yb3V0ZXJcblxuICAgICAgcmV0dXJuIE9iamVjdC5hc3NpZ24gQCB7fSwgbWV0YSwgLi4uYXJncywgaWRfaW5mb1xuXG4gICAgZnVuY3Rpb24gY3JlYXRlU1dJTSh7aG9zdCwgbWV0YSwgY2hhbm5lbCwgc3dpbV9wb3J0fSkgOjpcbiAgICAgIGxldCBjb25uX2luZm8gPSAnZnVuY3Rpb24nID09PSB0eXBlb2YgY2hhbm5lbCBcbiAgICAgICAgPyBjaGFubmVsIDogY2hhbm5lbC5jb25uX2luZm9cbiAgICAgIGlmIGNvbm5faW5mbyA6OlxuICAgICAgICBjb25zdCB7aXBfc2VydmVyLCBpcF9sb2NhbH0gPSBjb25uX2luZm8oKVxuICAgICAgICBjaGFubmVsID0gKGlwX3NlcnZlciB8fCBpcF9sb2NhbCkuYXNVUkwoKVxuICAgICAgICBpZiAhIGhvc3QgOjpcbiAgICAgICAgICBpZiAhIHN3aW1fcG9ydCA6OiBzd2ltX3BvcnQgPSBwbHVnaW5fb3B0aW9ucy5zd2ltX3BvcnRcbiAgICAgICAgICBob3N0ID0gYCR7KGlwX3NlcnZlciB8fCBpcF9sb2NhbCkuYWRkcmVzc306JHtzd2ltX3BvcnR9YFxuXG4gICAgICBpZiAhIGhvc3QgOjpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIEAgYFNXSU0gcGFja2FnZSByZXF1aXJlcyBhIHZhbGlkIFwiaG9zdFwiIHBhcmFtZXRlcmBcblxuICAgICAgbWV0YSA9IGFzc2lnblNXSU1NZXRhIEAgbWV0YSwgY2hhbm5lbCAmJiBAe30gY2hhbm5lbFxuICAgICAgY29uc3Qgc3dpbV9vcHRzID0gT2JqZWN0LmFzc2lnbiBAXG4gICAgICAgIHt9LCBwbHVnaW5fb3B0aW9ucy5zd2ltX2NvbmZpZ1xuICAgICAgICBAOiBsb2NhbDogQHt9IGhvc3QsIG1ldGFcblxuICAgICAgY29uc3Qgc3dpbSA9IG5ldyBTV0lNIEAgc3dpbV9vcHRzXG4gICAgICByZXR1cm4gbmV3IHN3aW1fcGx1Z2luLlN3aW1EaXNjb3ZlcnkgQCBodWIsIHN3aW1cblxuXG5cbmNsYXNzIFN3aW1EaXNjb3ZlcnkgOjpcbiAgY29uc3RydWN0b3IoaHViLCBzd2ltKSA6OlxuICAgIGNvbnN0IGJ5SWQgPSBuZXcgTWFwKClcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyBAIHRoaXMsIEA6XG4gICAgICBodWI6IEA6IHZhbHVlOiBodWJcbiAgICAgIHN3aW06IEA6IHZhbHVlOiBzd2ltXG4gICAgICBieUlkOiBAOiB2YWx1ZTogYnlJZFxuXG4gICAgdGhpcy5fYmluZFN3aW1VcGRhdGVzKHN3aW0sIGJ5SWQpXG5cbiAgbG9jYWxob3N0KCkgOjogcmV0dXJuIHRoaXMuc3dpbS5sb2NhbGhvc3QoKVxuXG4gIGJvb3RzdHJhcChzd2ltX2hvc3RzPVtdLCBzd2ltX3BvcnQpIDo6XG4gICAgY29uc3Qgc3dpbSA9IHRoaXMuc3dpbVxuICAgIGlmICdzdHJpbmcnID09PSB0eXBlb2Ygc3dpbV9ob3N0cyA6OlxuICAgICAgZG5zX3Jlc29sdmUgQCBzd2ltX2hvc3RzLCAoZXJyLCBob3N0cykgPT4gOjpcbiAgICAgICAgc3dpbV9ob3N0cyA9IGhvc3RzLm1hcCBAIGhvc3QgPT4gYCR7aG9zdH06JHtzd2ltX3BvcnR9YFxuICAgICAgICBzd2ltLmJvb3RzdHJhcCBAIHN3aW1faG9zdHNcbiAgICAgIHJldHVybiB0aGlzXG5cbiAgICBlbHNlIGlmIEFycmF5LmlzQXJyYXkgQCBzd2ltX2hvc3RzIDo6XG4gICAgICBpZiBzd2ltX3BvcnQgOjpcbiAgICAgICAgc3dpbV9ob3N0cyA9IHN3aW1faG9zdHMubWFwIEAgaG9zdCA9PiBgJHtob3N0fToke3N3aW1fcG9ydH1gXG4gICAgICBzd2ltLmJvb3RzdHJhcCBAIHN3aW1faG9zdHNcbiAgICAgIHJldHVybiB0aGlzXG5cbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yIEAgYFVuZXhwZWN0ZWQgJ3N3aW1faG9zdHMnIHBhcmFtZXRlciBmb3JtYXQuYFxuXG5cbiAgX2JpbmRTd2ltVXBkYXRlcyhzd2ltLCBieUlkKSA6OlxuICAgIGNvbnN0IHVwZGF0ZVByb3BzID0gQHt9IGJ5SWQ6IEA6IHZhbHVlOiBieUlkXG4gICAgY29uc3QgcHF1ZXVlID0gdGhpcy5wcm9taXNlUXVldWUgQCAoKSA9PiA6OlxuICAgICAgY29uc3QgdXBkYXRlcyA9IE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzIEAgW10sIHVwZGF0ZVByb3BzXG4gICAgICBjb25zdCBhbnMgPSBzbGVlcCgwLCB1cGRhdGVzKVxuICAgICAgYW5zLnVwZGF0ZXMgPSB1cGRhdGVzXG4gICAgICBmb3IgY29uc3Qgc3ViIG9mIHRoaXMuX3N1YnNjcmliZXJMaXN0IDo6XG4gICAgICAgIGFucy50aGVuKHN1YilcbiAgICAgIHJldHVybiBhbnNcblxuICAgIDo6XG4gICAgICBjb25zdCB7aG9zdCwgbWV0YX0gPSBzd2ltLm9wdHMubG9jYWxcbiAgICAgIF9vbl91cGRhdGVFbnRyeSBAIG1ldGEsICdzZWxmJywgaG9zdFxuXG4gICAgOjpcbiAgICAgIGNvbnN0IHN3aW1fc3RhdGVfbHV0ID0gdGhpcy5zd2ltX3N0YXRlX2x1dC5zbGljZSgpXG4gICAgICBzd2ltLm9uIEAgJ3VwZGF0ZScsIGV2dCA9PiA6OlxuICAgICAgICBfb25fdXBkYXRlRW50cnkgQCBldnQubWV0YSwgc3dpbV9zdGF0ZV9sdXRbZXZ0LnN0YXRlXSwgZXZ0Lmhvc3RcblxuICAgIGZ1bmN0aW9uIF9vbl91cGRhdGVFbnRyeShtZXRhLCBzd2ltX3N0YXRlLCBzd2ltX2hvc3QpIDo6XG4gICAgICBjb25zdCB7aWRfcm91dGVyLCBlY19wdWJfaWR9ID0gbWV0YVxuICAgICAgY29uc3QgY3VyID0gYnlJZC5nZXQoaWRfcm91dGVyKVxuICAgICAgaWYgdW5kZWZpbmVkICE9PSBjdXIgJiYgZWNfcHViX2lkICE9IGN1ci5lY19wdWJfaWQgOjpcbiAgICAgICAgcmV0dXJuIC8vIHJlZnVzZSB0byBvdmVycmlkZSBleGlzdGluZyBlbnRyaWVzIHdpdGggbWlzbWF0Y2hlZCBlY19wdWJfaWRcblxuICAgICAgY29uc3QgZW50cnkgPSBPYmplY3QuYXNzaWduIEAge30sIG1ldGEsIEB7fSBzd2ltX3N0YXRlLCBzd2ltX2hvc3QsIHN3aW1fdHM6IG5ldyBEYXRlKClcbiAgICAgIGJ5SWQuc2V0IEAgaWRfcm91dGVyLCBlbnRyeVxuICAgICAgcHF1ZXVlKCkudXBkYXRlcy5wdXNoIEAgZW50cnlcblxuXG4gIHJlZ2lzdGVyUm91dGVyRGlzY292ZXJ5KGh1YikgOjpcbiAgICBpZiBudWxsID09IGh1YiA6OiBodWIgPSB0aGlzLmh1YlxuXG4gICAgY29uc3QgcmVzb2x2ZVJvdXRlcklkID0gYXN5bmMgaWRfcm91dGVyID0+IDo6XG4gICAgICBjb25zdCBlbnRyeSA9IHRoaXMuYnlJZC5nZXQoaWRfcm91dGVyKVxuICAgICAgaWYgdW5kZWZpbmVkID09PSBlbnRyeSA6OiByZXR1cm5cblxuICAgICAgY29uc3QgY2hhbiA9IGF3YWl0IGh1Yi5jb25uZWN0IEAgZW50cnkuY2hhbm5lbFxuICAgICAgcmV0dXJuIGNoYW4uc2VuZFJhd1xuXG4gICAgaHViLnJvdXRlci5fcm91dGVEaXNjb3ZlcnkucHVzaCBAIHJlc29sdmVSb3V0ZXJJZFxuICAgIHJldHVybiB0aGlzXG5cblxuICBfc3Vic2NyaWJlckxpc3QgPSBbXVxuICBzdWJzY3JpYmUoY2FsbGJhY2spIDo6XG4gICAgdGhpcy5fc3Vic2NyaWJlckxpc3QucHVzaCBAIGNhbGxiYWNrXG4gICAgcmV0dXJuIHRoaXNcblxuc3dpbV9wbHVnaW4uU3dpbURpc2NvdmVyeSA9IFN3aW1EaXNjb3Zlcnlcbk9iamVjdC5hc3NpZ24gQCBTd2ltRGlzY292ZXJ5LnByb3RvdHlwZSwgQDpcbiAgc3dpbV9zdGF0ZV9sdXQ6IEBbXSAnYWxpdmUnLCAnc3VzcGVjdCcsICdkZWFkJ1xuICBwcm9taXNlUXVldWVcblxuXG5mdW5jdGlvbiBzbGVlcChtcywgY3R4KSA6OlxuICByZXR1cm4gbmV3IFByb21pc2UgQCByZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMsIGN0eClcblxuZnVuY3Rpb24gcHJvbWlzZVF1ZXVlKG5leHRQcm9taXNlKSA6OlxuICBsZXQgdGlwID0gbnVsbFxuICByZXR1cm4gZnVuY3Rpb24gKCkgOjpcbiAgICBpZiBudWxsID09PSB0aXAgOjpcbiAgICAgIHRpcCA9IG5leHRQcm9taXNlKClcbiAgICAgIHRpcC50aGVuIEAgY2xlYXJfdGlwXG4gICAgcmV0dXJuIHRpcFxuXG4gIGZ1bmN0aW9uIGNsZWFyX3RpcCgpIDo6XG4gICAgdGlwID0gbnVsbFxuXG4iXSwibmFtZXMiOlsic3dpbV9wbHVnaW4iLCJkZWZhdWx0X29wdGlvbnMiLCJwbHVnaW5fb3B0aW9ucyIsIk9iamVjdCIsImFzc2lnbiIsImh1YiIsImNyZWF0ZVNXSU0iLCJhc3NpZ25TV0lNTWV0YSIsIm1ldGEiLCJhcmdzIiwiaWRfc2VsZiIsImlkX3JvdXRlciIsImVjX3B1Yl9pZCIsInJvdXRlciIsImlkX2luZm8iLCJ0b1N0cmluZyIsImhvc3QiLCJjaGFubmVsIiwic3dpbV9wb3J0IiwiY29ubl9pbmZvIiwiaXBfc2VydmVyIiwiaXBfbG9jYWwiLCJhc1VSTCIsImFkZHJlc3MiLCJFcnJvciIsInN3aW1fb3B0cyIsInN3aW1fY29uZmlnIiwibG9jYWwiLCJzd2ltIiwiU1dJTSIsIlN3aW1EaXNjb3ZlcnkiLCJfc3Vic2NyaWJlckxpc3QiLCJieUlkIiwiTWFwIiwiZGVmaW5lUHJvcGVydGllcyIsInZhbHVlIiwiX2JpbmRTd2ltVXBkYXRlcyIsImxvY2FsaG9zdCIsInN3aW1faG9zdHMiLCJlcnIiLCJob3N0cyIsIm1hcCIsImJvb3RzdHJhcCIsIkFycmF5IiwiaXNBcnJheSIsIlR5cGVFcnJvciIsInVwZGF0ZVByb3BzIiwicHF1ZXVlIiwicHJvbWlzZVF1ZXVlIiwidXBkYXRlcyIsImFucyIsInNsZWVwIiwic3ViIiwidGhlbiIsIm9wdHMiLCJzd2ltX3N0YXRlX2x1dCIsInNsaWNlIiwib24iLCJldnQiLCJzdGF0ZSIsIl9vbl91cGRhdGVFbnRyeSIsInN3aW1fc3RhdGUiLCJzd2ltX2hvc3QiLCJjdXIiLCJnZXQiLCJ1bmRlZmluZWQiLCJlbnRyeSIsInN3aW1fdHMiLCJEYXRlIiwic2V0IiwicHVzaCIsInJlc29sdmVSb3V0ZXJJZCIsImNoYW4iLCJjb25uZWN0Iiwic2VuZFJhdyIsIl9yb3V0ZURpc2NvdmVyeSIsImNhbGxiYWNrIiwicHJvdG90eXBlIiwibXMiLCJjdHgiLCJQcm9taXNlIiwicmVzb2x2ZSIsInNldFRpbWVvdXQiLCJuZXh0UHJvbWlzZSIsInRpcCIsImNsZWFyX3RpcCJdLCJtYXBwaW5ncyI6Ijs7O0FBR0FBLFlBQVlDLGVBQVosR0FBOEI7YUFDakIsSUFEaUI7ZUFFZjtjQUNELEdBREM7aUJBRUUsR0FGRjtpQkFHRSxFQUhGO29CQUlLLEVBSkw7c0JBS08sQ0FMUCxFQUZlLEVBQTlCOztBQVNBLEFBQWUsU0FBU0QsV0FBVCxDQUFxQkUsY0FBckIsRUFBcUM7bUJBQ2pDQyxPQUFPQyxNQUFQLENBQWdCLEVBQWhCLEVBQW9CSixZQUFZQyxlQUFoQyxFQUFpREMsY0FBakQsQ0FBakI7O1NBRU8sVUFBVUcsR0FBVixFQUFlO1FBQ2hCQyxVQUFKLEdBQWlCQSxVQUFqQjs7YUFFU0MsY0FBVCxDQUF3QkMsSUFBeEIsRUFBOEIsR0FBR0MsSUFBakMsRUFBdUM7WUFDL0IsRUFBQ0MsU0FBU0MsU0FBVixFQUFxQkMsU0FBckIsS0FBa0NQLElBQUlRLE1BQTVDO1lBQ01DLFVBQVVGLFlBQ1osRUFBSUQsU0FBSjttQkFDZUMsVUFBVUcsUUFBVixDQUFtQixRQUFuQixDQURmLEVBRFksR0FHWixFQUFJSixTQUFKLEVBSEo7O2FBS09SLE9BQU9DLE1BQVAsQ0FBZ0IsRUFBaEIsRUFBb0JJLElBQXBCLEVBQTBCLEdBQUdDLElBQTdCLEVBQW1DSyxPQUFuQyxDQUFQOzs7YUFFT1IsVUFBVCxDQUFvQixFQUFDVSxJQUFELEVBQU9SLElBQVAsRUFBYVMsT0FBYixFQUFzQkMsU0FBdEIsRUFBcEIsRUFBc0Q7VUFDaERDLFlBQVksZUFBZSxPQUFPRixPQUF0QixHQUNaQSxPQURZLEdBQ0ZBLFFBQVFFLFNBRHRCO1VBRUdBLFNBQUgsRUFBZTtjQUNQLEVBQUNDLFNBQUQsRUFBWUMsUUFBWixLQUF3QkYsV0FBOUI7a0JBQ1UsQ0FBQ0MsYUFBYUMsUUFBZCxFQUF3QkMsS0FBeEIsRUFBVjtZQUNHLENBQUVOLElBQUwsRUFBWTtjQUNQLENB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
