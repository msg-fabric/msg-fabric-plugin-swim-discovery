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
          host = `${(ip_server || ip_local).address}:${swim_port}:${hub.id_self}`;
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

export default swim_plugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3dpbV9kaXNjb3ZlcnkubWpzIiwic291cmNlcyI6WyIuLi9jb2RlL3N3aW1fZGlzY292ZXJ5LmpzeSJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge3Jlc29sdmUgYXMgZG5zX3Jlc29sdmV9IGZyb20gJ2RucydcbmltcG9ydCBTV0lNIGZyb20gJ3N3aW0nXG5cbnN3aW1fcGx1Z2luLmRlZmF1bHRfb3B0aW9ucyA9IEB7fVxuICBzd2ltX3BvcnQ6IDI3MDBcbiAgc3dpbV9jb25maWc6IEB7fVxuICAgIGludGVydmFsOiAxMDBcbiAgICBqb2luVGltZW91dDogMzAwXG4gICAgcGluZ1RpbWVvdXQ6IDMwXG4gICAgcGluZ1JlcVRpbWVvdXQ6IDgwXG4gICAgcGluZ1JlcUdyb3VwU2l6ZTogMlxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBzd2ltX3BsdWdpbihwbHVnaW5fb3B0aW9ucykgOjpcbiAgcGx1Z2luX29wdGlvbnMgPSBPYmplY3QuYXNzaWduIEAge30sIHN3aW1fcGx1Z2luLmRlZmF1bHRfb3B0aW9ucywgcGx1Z2luX29wdGlvbnNcblxuICByZXR1cm4gZnVuY3Rpb24gKGh1YikgOjpcbiAgICBodWIuY3JlYXRlU1dJTSA9IGNyZWF0ZVNXSU1cblxuICAgIGZ1bmN0aW9uIGFzc2lnblNXSU1NZXRhKG1ldGEsIC4uLmFyZ3MpIDo6XG4gICAgICBjb25zdCB7aWRfc2VsZjogaWRfcm91dGVyLCBlY19wdWJfaWR9ID0gaHViLnJvdXRlclxuICAgICAgY29uc3QgaWRfaW5mbyA9IGVjX3B1Yl9pZCBcbiAgICAgICAgPyBAe30gaWRfcm91dGVyXG4gICAgICAgICAgICAgIGVjX3B1Yl9pZDogZWNfcHViX2lkLnRvU3RyaW5nKCdiYXNlNjQnKVxuICAgICAgICA6IEB7fSBpZF9yb3V0ZXJcblxuICAgICAgcmV0dXJuIE9iamVjdC5hc3NpZ24gQCB7fSwgbWV0YSwgLi4uYXJncywgaWRfaW5mb1xuXG4gICAgZnVuY3Rpb24gY3JlYXRlU1dJTSh7aG9zdCwgbWV0YSwgY2hhbm5lbCwgc3dpbV9wb3J0fSkgOjpcbiAgICAgIGxldCBjb25uX2luZm8gPSAnZnVuY3Rpb24nID09PSB0eXBlb2YgY2hhbm5lbCBcbiAgICAgICAgPyBjaGFubmVsIDogY2hhbm5lbC5jb25uX2luZm9cbiAgICAgIGlmIGNvbm5faW5mbyA6OlxuICAgICAgICBjb25zdCB7aXBfc2VydmVyLCBpcF9sb2NhbH0gPSBjb25uX2luZm8oKVxuICAgICAgICBjaGFubmVsID0gKGlwX3NlcnZlciB8fCBpcF9sb2NhbCkuYXNVUkwoKVxuICAgICAgICBpZiAhIGhvc3QgOjpcbiAgICAgICAgICBpZiAhIHN3aW1fcG9ydCA6OiBzd2ltX3BvcnQgPSBwbHVnaW5fb3B0aW9ucy5zd2ltX3BvcnRcbiAgICAgICAgICBob3N0ID0gYCR7KGlwX3NlcnZlciB8fCBpcF9sb2NhbCkuYWRkcmVzc306JHtzd2ltX3BvcnR9OiR7aHViLmlkX3NlbGZ9YFxuXG4gICAgICBpZiAhIGhvc3QgOjpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIEAgYFNXSU0gcGFja2FnZSByZXF1aXJlcyBhIHZhbGlkIFwiaG9zdFwiIHBhcmFtZXRlcmBcblxuICAgICAgbWV0YSA9IGFzc2lnblNXSU1NZXRhIEAgbWV0YSwgY2hhbm5lbCAmJiBAe30gY2hhbm5lbFxuICAgICAgY29uc3Qgc3dpbV9vcHRzID0gT2JqZWN0LmFzc2lnbiBAXG4gICAgICAgIHt9LCBwbHVnaW5fb3B0aW9ucy5zd2ltX2NvbmZpZ1xuICAgICAgICBAOiBsb2NhbDogQHt9IGhvc3QsIG1ldGFcblxuICAgICAgY29uc3Qgc3dpbSA9IG5ldyBTV0lNIEAgc3dpbV9vcHRzXG4gICAgICByZXR1cm4gbmV3IHN3aW1fcGx1Z2luLlN3aW1EaXNjb3ZlcnkgQCBodWIsIHN3aW1cblxuXG5cbmNsYXNzIFN3aW1EaXNjb3ZlcnkgOjpcbiAgY29uc3RydWN0b3IoaHViLCBzd2ltKSA6OlxuICAgIGNvbnN0IGJ5SWQgPSBuZXcgTWFwKClcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyBAIHRoaXMsIEA6XG4gICAgICBodWI6IEA6IHZhbHVlOiBodWJcbiAgICAgIHN3aW06IEA6IHZhbHVlOiBzd2ltXG4gICAgICBieUlkOiBAOiB2YWx1ZTogYnlJZFxuXG4gICAgdGhpcy5fYmluZFN3aW1VcGRhdGVzKHN3aW0sIGJ5SWQpXG5cbiAgbG9jYWxob3N0KCkgOjogcmV0dXJuIHRoaXMuc3dpbS5sb2NhbGhvc3QoKVxuXG4gIGJvb3RzdHJhcChzd2ltX2hvc3RzPVtdLCBzd2ltX3BvcnQpIDo6XG4gICAgY29uc3Qgc3dpbSA9IHRoaXMuc3dpbVxuICAgIGlmICdzdHJpbmcnID09PSB0eXBlb2Ygc3dpbV9ob3N0cyA6OlxuICAgICAgZG5zX3Jlc29sdmUgQCBzd2ltX2hvc3RzLCAoZXJyLCBob3N0cykgPT4gOjpcbiAgICAgICAgc3dpbV9ob3N0cyA9IGhvc3RzLm1hcCBAIGhvc3QgPT4gYCR7aG9zdH06JHtzd2ltX3BvcnR9YFxuICAgICAgICBzd2ltLmJvb3RzdHJhcCBAIHN3aW1faG9zdHNcbiAgICAgIHJldHVybiB0aGlzXG5cbiAgICBlbHNlIGlmIEFycmF5LmlzQXJyYXkgQCBzd2ltX2hvc3RzIDo6XG4gICAgICBpZiBzd2ltX3BvcnQgOjpcbiAgICAgICAgc3dpbV9ob3N0cyA9IHN3aW1faG9zdHMubWFwIEAgaG9zdCA9PlxuICAgICAgICAgIGhvc3QuaW5jbHVkZXMoJzonKSA/IGhvc3QgOiBgJHtob3N0fToke3N3aW1fcG9ydH1gXG4gICAgICBzd2ltLmJvb3RzdHJhcCBAIHN3aW1faG9zdHNcbiAgICAgIHJldHVybiB0aGlzXG5cbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yIEAgYFVuZXhwZWN0ZWQgJ3N3aW1faG9zdHMnIHBhcmFtZXRlciBmb3JtYXQuYFxuXG5cbiAgX2JpbmRTd2ltVXBkYXRlcyhzd2ltLCBieUlkKSA6OlxuICAgIGNvbnN0IHVwZGF0ZVByb3BzID0gQHt9IGJ5SWQ6IEA6IHZhbHVlOiBieUlkXG4gICAgY29uc3QgcHF1ZXVlID0gdGhpcy5wcm9taXNlUXVldWUgQCAoKSA9PiA6OlxuICAgICAgY29uc3QgdXBkYXRlcyA9IE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzIEAgW10sIHVwZGF0ZVByb3BzXG4gICAgICBjb25zdCBhbnMgPSBzbGVlcCgwLCB1cGRhdGVzKVxuICAgICAgYW5zLnVwZGF0ZXMgPSB1cGRhdGVzXG4gICAgICBmb3IgY29uc3Qgc3ViIG9mIHRoaXMuX3N1YnNjcmliZXJMaXN0IDo6XG4gICAgICAgIGFucy50aGVuKHN1YilcbiAgICAgIHJldHVybiBhbnNcblxuICAgIDo6XG4gICAgICBjb25zdCB7aG9zdCwgbWV0YX0gPSBzd2ltLm9wdHMubG9jYWxcbiAgICAgIF9vbl91cGRhdGVFbnRyeSBAIG1ldGEsICdzZWxmJywgaG9zdFxuXG4gICAgOjpcbiAgICAgIGNvbnN0IHN3aW1fc3RhdGVfbHV0ID0gdGhpcy5zd2ltX3N0YXRlX2x1dC5zbGljZSgpXG4gICAgICBzd2ltLm9uIEAgJ3VwZGF0ZScsIGV2dCA9PiA6OlxuICAgICAgICBfb25fdXBkYXRlRW50cnkgQCBldnQubWV0YSwgc3dpbV9zdGF0ZV9sdXRbZXZ0LnN0YXRlXSwgZXZ0Lmhvc3RcblxuICAgIGZ1bmN0aW9uIF9vbl91cGRhdGVFbnRyeShtZXRhLCBzd2ltX3N0YXRlLCBzd2ltX2hvc3QpIDo6XG4gICAgICBjb25zdCB7aWRfcm91dGVyLCBlY19wdWJfaWR9ID0gbWV0YVxuICAgICAgY29uc3QgY3VyID0gYnlJZC5nZXQoaWRfcm91dGVyKVxuICAgICAgaWYgdW5kZWZpbmVkICE9PSBjdXIgJiYgZWNfcHViX2lkICE9IGN1ci5lY19wdWJfaWQgOjpcbiAgICAgICAgcmV0dXJuIC8vIHJlZnVzZSB0byBvdmVycmlkZSBleGlzdGluZyBlbnRyaWVzIHdpdGggbWlzbWF0Y2hlZCBlY19wdWJfaWRcblxuICAgICAgY29uc3QgZW50cnkgPSBPYmplY3QuYXNzaWduIEAge30sIG1ldGEsIEB7fSBzd2ltX3N0YXRlLCBzd2ltX2hvc3QsIHN3aW1fdHM6IG5ldyBEYXRlKClcbiAgICAgIGJ5SWQuc2V0IEAgaWRfcm91dGVyLCBlbnRyeVxuICAgICAgcHF1ZXVlKCkudXBkYXRlcy5wdXNoIEAgZW50cnlcblxuXG4gIHJlZ2lzdGVyUm91dGVyRGlzY292ZXJ5KGh1YikgOjpcbiAgICBpZiBudWxsID09IGh1YiA6OiBodWIgPSB0aGlzLmh1YlxuXG4gICAgY29uc3QgcmVzb2x2ZVJvdXRlcklkID0gYXN5bmMgaWRfcm91dGVyID0+IDo6XG4gICAgICBjb25zdCBlbnRyeSA9IHRoaXMuYnlJZC5nZXQoaWRfcm91dGVyKVxuICAgICAgaWYgdW5kZWZpbmVkID09PSBlbnRyeSA6OiByZXR1cm5cblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGNvbnN0IGNoYW4gPSBhd2FpdCBodWIuY29ubmVjdCBAIGVudHJ5LmNoYW5uZWxcbiAgICAgICAgcmV0dXJuIGNoYW4uc2VuZFJhd1xuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIHRoaXMuYnlJZC5kZWxldGUoaWRfcm91dGVyKVxuICAgICAgICBpZiBlcnIgJiYgJ0VDT05OUkVGVVNFRCcgIT09IGVyci5jb2RlIDo6XG4gICAgICAgICAgdGhyb3cgZXJyIC8vIHJlLXRocm93IGlmIG5vdCByZWNvZ25pemVkXG5cbiAgICBodWIucm91dGVyLnJvdXRlRGlzY292ZXJ5LnB1c2ggQCByZXNvbHZlUm91dGVySWRcbiAgICByZXR1cm4gdGhpc1xuXG5cbiAgX3N1YnNjcmliZXJMaXN0ID0gW11cbiAgc3Vic2NyaWJlKGNhbGxiYWNrKSA6OlxuICAgIHRoaXMuX3N1YnNjcmliZXJMaXN0LnB1c2ggQCBjYWxsYmFja1xuICAgIHJldHVybiB0aGlzXG5cbnN3aW1fcGx1Z2luLlN3aW1EaXNjb3ZlcnkgPSBTd2ltRGlzY292ZXJ5XG5PYmplY3QuYXNzaWduIEAgU3dpbURpc2NvdmVyeS5wcm90b3R5cGUsIEA6XG4gIHN3aW1fc3RhdGVfbHV0OiBAW10gJ2FsaXZlJywgJ3N1c3BlY3QnLCAnZGVhZCdcbiAgcHJvbWlzZVF1ZXVlXG5cblxuZnVuY3Rpb24gc2xlZXAobXMsIGN0eCkgOjpcbiAgcmV0dXJuIG5ldyBQcm9taXNlIEAgcmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zLCBjdHgpXG5cbmZ1bmN0aW9uIHByb21pc2VRdWV1ZShuZXh0UHJvbWlzZSkgOjpcbiAgbGV0IHRpcCA9IG51bGxcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIDo6XG4gICAgaWYgbnVsbCA9PT0gdGlwIDo6XG4gICAgICB0aXAgPSBuZXh0UHJvbWlzZSgpXG4gICAgICB0aXAudGhlbiBAIGNsZWFyX3RpcFxuICAgIHJldHVybiB0aXBcblxuICBmdW5jdGlvbiBjbGVhcl90aXAoKSA6OlxuICAgIHRpcCA9IG51bGxcblxuIl0sIm5hbWVzIjpbInN3aW1fcGx1Z2luIiwiZGVmYXVsdF9vcHRpb25zIiwicGx1Z2luX29wdGlvbnMiLCJPYmplY3QiLCJhc3NpZ24iLCJodWIiLCJjcmVhdGVTV0lNIiwiYXNzaWduU1dJTU1ldGEiLCJtZXRhIiwiYXJncyIsImlkX3NlbGYiLCJpZF9yb3V0ZXIiLCJlY19wdWJfaWQiLCJyb3V0ZXIiLCJpZF9pbmZvIiwidG9TdHJpbmciLCJob3N0IiwiY2hhbm5lbCIsInN3aW1fcG9ydCIsImNvbm5faW5mbyIsImlwX3NlcnZlciIsImlwX2xvY2FsIiwiYXNVUkwiLCJhZGRyZXNzIiwiRXJyb3IiLCJzd2ltX29wdHMiLCJzd2ltX2NvbmZpZyIsImxvY2FsIiwic3dpbSIsIlNXSU0iLCJTd2ltRGlzY292ZXJ5IiwiX3N1YnNjcmliZXJMaXN0IiwiYnlJZCIsIk1hcCIsImRlZmluZVByb3BlcnRpZXMiLCJ2YWx1ZSIsIl9iaW5kU3dpbVVwZGF0ZXMiLCJsb2NhbGhvc3QiLCJzd2ltX2hvc3RzIiwiZXJyIiwiaG9zdHMiLCJtYXAiLCJib290c3RyYXAiLCJBcnJheSIsImlzQXJyYXkiLCJpbmNsdWRlcyIsIlR5cGVFcnJvciIsInVwZGF0ZVByb3BzIiwicHF1ZXVlIiwicHJvbWlzZVF1ZXVlIiwidXBkYXRlcyIsImFucyIsInNsZWVwIiwic3ViIiwidGhlbiIsIm9wdHMiLCJzd2ltX3N0YXRlX2x1dCIsInNsaWNlIiwib24iLCJldnQiLCJzdGF0ZSIsIl9vbl91cGRhdGVFbnRyeSIsInN3aW1fc3RhdGUiLCJzd2ltX2hvc3QiLCJjdXIiLCJnZXQiLCJ1bmRlZmluZWQiLCJlbnRyeSIsInN3aW1fdHMiLCJEYXRlIiwic2V0IiwicHVzaCIsInJlc29sdmVSb3V0ZXJJZCIsImNoYW4iLCJjb25uZWN0Iiwic2VuZFJhdyIsImRlbGV0ZSIsImNvZGUiLCJyb3V0ZURpc2NvdmVyeSIsImNhbGxiYWNrIiwicHJvdG90eXBlIiwibXMiLCJjdHgiLCJQcm9taXNlIiwicmVzb2x2ZSIsInNldFRpbWVvdXQiLCJuZXh0UHJvbWlzZSIsInRpcCIsImNsZWFyX3RpcCJdLCJtYXBwaW5ncyI6Ijs7O0FBR0FBLFlBQVlDLGVBQVosR0FBOEI7YUFDakIsSUFEaUI7ZUFFZjtjQUNELEdBREM7aUJBRUUsR0FGRjtpQkFHRSxFQUhGO29CQUlLLEVBSkw7c0JBS08sQ0FMUCxFQUZlLEVBQTlCOztBQVNBLEFBQWUsU0FBU0QsV0FBVCxDQUFxQkUsY0FBckIsRUFBcUM7bUJBQ2pDQyxPQUFPQyxNQUFQLENBQWdCLEVBQWhCLEVBQW9CSixZQUFZQyxlQUFoQyxFQUFpREMsY0FBakQsQ0FBakI7O1NBRU8sVUFBVUcsR0FBVixFQUFlO1FBQ2hCQyxVQUFKLEdBQWlCQSxVQUFqQjs7YUFFU0MsY0FBVCxDQUF3QkMsSUFBeEIsRUFBOEIsR0FBR0MsSUFBakMsRUFBdUM7WUFDL0IsRUFBQ0MsU0FBU0MsU0FBVixFQUFxQkMsU0FBckIsS0FBa0NQLElBQUlRLE1BQTVDO1lBQ01DLFVBQVVGLFlBQ1osRUFBSUQsU0FBSjttQkFDZUMsVUFBVUcsUUFBVixDQUFtQixRQUFuQixDQURmLEVBRFksR0FHWixFQUFJSixTQUFKLEVBSEo7O2FBS09SLE9BQU9DLE1BQVAsQ0FBZ0IsRUFBaEIsRUFBb0JJLElBQXBCLEVBQTBCLEdBQUdDLElBQTdCLEVBQW1DSyxPQUFuQyxDQUFQOzs7YUFF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
