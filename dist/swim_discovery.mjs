import { resolve } from 'dns';
import SWIM from 'swim';

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
    return this._perform_with_swim_hosts(swim_hosts, swim_port, (swim, swim_hosts, callback) => swim.bootstrap(swim_hosts, callback));
  }

  join(swim_hosts = [], swim_port) {
    return this._perform_with_swim_hosts(swim_hosts, swim_port, (swim, swim_hosts, callback) => swim.join(swim_hosts, callback));
  }

  _perform_with_swim_hosts(swim_hosts, swim_port, callback) {
    return new Promise((resolve$$1, reject) => {
      try {
        const swim = this.swim;
        if ('string' === typeof swim_hosts) {
          if (!swim_port) {
            throw new TypeError(`'swim_port' must be provided when boostrapping using DNS`);
          }

          resolve(swim_hosts, (err, hosts) => {
            if (err) {
              return reject(err);
            }
            if (hosts) {
              swim_hosts = hosts.map(host => `${host}:${swim_port}`);
              callback(swim, swim_hosts, (err, ans) => err ? reject(err) : resolve$$1(ans));
            }
          });
          return this;
        } else if (Array.isArray(swim_hosts)) {
          if (swim_port) {
            swim_hosts = swim_hosts.map(host => host.includes(':') ? host : `${host}:${swim_port}`);
          }
          callback(swim, swim_hosts, (err, ans) => err ? reject(err) : resolve$$1(ans));
          return this;
        }

        throw new TypeError(`Unexpected 'swim_hosts' parameter format.`);
      } catch (err) {
        reject(err);
      }
    });
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3dpbV9kaXNjb3ZlcnkubWpzIiwic291cmNlcyI6WyIuLi9jb2RlL3N3aW1fZGlzY292ZXJ5LmpzeSJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge3Jlc29sdmUgYXMgZG5zX3Jlc29sdmV9IGZyb20gJ2RucydcbmltcG9ydCBTV0lNIGZyb20gJ3N3aW0nXG5cbmNvbnN0IHRzXzIwMTVfZXBvY2ggPSAxNDIwMDcwNDAwMDAwIC8vIG5ldyBEYXRlKCcyMDE1LTAxLTAxVDAwOjAwOjAwLjAwMFonKS52YWx1ZU9mKClcblxuc3dpbV9wbHVnaW4uZGVmYXVsdF9vcHRpb25zID0gQHt9XG4gIHN3aW1fcG9ydDogMjcwMFxuICBzd2ltX2NvbmZpZzogQHt9XG4gICAgaW50ZXJ2YWw6IDEwMFxuICAgIGpvaW5UaW1lb3V0OiAzMDBcbiAgICBwaW5nVGltZW91dDogMzBcbiAgICBwaW5nUmVxVGltZW91dDogODBcbiAgICBwaW5nUmVxR3JvdXBTaXplOiAyXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHN3aW1fcGx1Z2luKHBsdWdpbl9vcHRpb25zKSA6OlxuICBwbHVnaW5fb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24gQCB7fSwgc3dpbV9wbHVnaW4uZGVmYXVsdF9vcHRpb25zLCBwbHVnaW5fb3B0aW9uc1xuXG4gIHJldHVybiBmdW5jdGlvbiAoaHViKSA6OlxuICAgIGh1Yi5jcmVhdGVTV0lNID0gY3JlYXRlU1dJTVxuXG4gICAgZnVuY3Rpb24gYXNzaWduU1dJTU1ldGEobWV0YSwgLi4uYXJncykgOjpcbiAgICAgIGNvbnN0IHtpZF9zZWxmOiBpZF9yb3V0ZXIsIGVjX3B1Yl9pZH0gPSBodWIucm91dGVyXG4gICAgICBjb25zdCBpZF9pbmZvID0gZWNfcHViX2lkIFxuICAgICAgICA/IEB7fSBpZF9yb3V0ZXJcbiAgICAgICAgICAgICAgZWNfcHViX2lkOiBlY19wdWJfaWQudG9TdHJpbmcoJ2Jhc2U2NCcpXG4gICAgICAgIDogQHt9IGlkX3JvdXRlclxuXG4gICAgICByZXR1cm4gT2JqZWN0LmFzc2lnbiBAIHt9LCBtZXRhLCAuLi5hcmdzLCBpZF9pbmZvXG5cbiAgICBmdW5jdGlvbiBjcmVhdGVTV0lNKHtob3N0LCBtZXRhLCBjaGFubmVsLCBzd2ltX3BvcnQsIGluY2FybmF0aW9ufSkgOjpcbiAgICAgIGxldCBjb25uX2luZm8gPSAnZnVuY3Rpb24nID09PSB0eXBlb2YgY2hhbm5lbCBcbiAgICAgICAgPyBjaGFubmVsIDogY2hhbm5lbC5jb25uX2luZm9cbiAgICAgIGlmIGNvbm5faW5mbyA6OlxuICAgICAgICBjb25zdCB7aXBfc2VydmVyLCBpcF9sb2NhbH0gPSBjb25uX2luZm8oKVxuICAgICAgICBjaGFubmVsID0gKGlwX3NlcnZlciB8fCBpcF9sb2NhbCkuYXNVUkwoKVxuICAgICAgICBpZiAhIGhvc3QgOjpcbiAgICAgICAgICBpZiAhIHN3aW1fcG9ydCA6OiBzd2ltX3BvcnQgPSBwbHVnaW5fb3B0aW9ucy5zd2ltX3BvcnRcbiAgICAgICAgICBob3N0ID0gYCR7KGlwX3NlcnZlciB8fCBpcF9sb2NhbCkuYWRkcmVzc306JHtzd2ltX3BvcnR9YFxuXG4gICAgICBpZiAhIGhvc3QgOjpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIEAgYFNXSU0gcGFja2FnZSByZXF1aXJlcyBhIHZhbGlkIFwiaG9zdFwiIHBhcmFtZXRlcmBcbiAgICAgIGlmIG51bGwgPT0gaW5jYXJuYXRpb24gOjpcbiAgICAgICAgLy8gdXNlIGEgcm91Z2ggdGltZS1iYXNlZCBpbmNhcm5hdGlvbiB0byBoZWxwIHdpdGggcmV1c2luZyBpcC9wb3J0XG4gICAgICAgIGluY2FybmF0aW9uID0gRGF0ZS5ub3coKSAtIHRzXzIwMTVfZXBvY2hcblxuICAgICAgbWV0YSA9IGFzc2lnblNXSU1NZXRhIEAgbWV0YSwgY2hhbm5lbCAmJiBAe30gY2hhbm5lbFxuICAgICAgY29uc3Qgc3dpbV9vcHRzID0gT2JqZWN0LmFzc2lnbiBAXG4gICAgICAgIHt9LCBwbHVnaW5fb3B0aW9ucy5zd2ltX2NvbmZpZ1xuICAgICAgICBAOiBsb2NhbDogQHt9IGhvc3QsIG1ldGEsIGluY2FybmF0aW9uXG5cbiAgICAgIGNvbnN0IHN3aW0gPSBuZXcgU1dJTSBAIHN3aW1fb3B0c1xuICAgICAgcmV0dXJuIG5ldyBzd2ltX3BsdWdpbi5Td2ltRGlzY292ZXJ5IEAgaHViLCBzd2ltXG5cblxuXG5jbGFzcyBTd2ltRGlzY292ZXJ5IDo6XG4gIGNvbnN0cnVjdG9yKGh1Yiwgc3dpbSkgOjpcbiAgICBjb25zdCBieUlkID0gbmV3IE1hcCgpXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMgQCB0aGlzLCBAOlxuICAgICAgaHViOiBAOiB2YWx1ZTogaHViXG4gICAgICBzd2ltOiBAOiB2YWx1ZTogc3dpbVxuICAgICAgYnlJZDogQDogdmFsdWU6IGJ5SWRcblxuICAgIHRoaXMuX2JpbmRTd2ltVXBkYXRlcyhzd2ltLCBieUlkKVxuXG4gIGxvY2FsaG9zdCgpIDo6IHJldHVybiB0aGlzLnN3aW0ubG9jYWxob3N0KClcblxuICBib290c3RyYXAoc3dpbV9ob3N0cz1bXSwgc3dpbV9wb3J0KSA6OlxuICAgIHJldHVybiB0aGlzLl9wZXJmb3JtX3dpdGhfc3dpbV9ob3N0cyBAIHN3aW1faG9zdHMsIHN3aW1fcG9ydFxuICAgICAgKHN3aW0sIHN3aW1faG9zdHMsIGNhbGxiYWNrKSA9PiBzd2ltLmJvb3RzdHJhcChzd2ltX2hvc3RzLCBjYWxsYmFjaylcblxuICBqb2luKHN3aW1faG9zdHM9W10sIHN3aW1fcG9ydCkgOjpcbiAgICByZXR1cm4gdGhpcy5fcGVyZm9ybV93aXRoX3N3aW1faG9zdHMgQCBzd2ltX2hvc3RzLCBzd2ltX3BvcnRcbiAgICAgIChzd2ltLCBzd2ltX2hvc3RzLCBjYWxsYmFjaykgPT4gc3dpbS5qb2luKHN3aW1faG9zdHMsIGNhbGxiYWNrKVxuXG4gIF9wZXJmb3JtX3dpdGhfc3dpbV9ob3N0cyhzd2ltX2hvc3RzLCBzd2ltX3BvcnQsIGNhbGxiYWNrKSA6OlxuICAgIHJldHVybiBuZXcgUHJvbWlzZSBAIChyZXNvbHZlLCByZWplY3QpID0+IDo6XG4gICAgICB0cnkgOjpcbiAgICAgICAgY29uc3Qgc3dpbSA9IHRoaXMuc3dpbVxuICAgICAgICBpZiAnc3RyaW5nJyA9PT0gdHlwZW9mIHN3aW1faG9zdHMgOjpcbiAgICAgICAgICBpZiAhIHN3aW1fcG9ydCA6OlxuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvciBAIGAnc3dpbV9wb3J0JyBtdXN0IGJlIHByb3ZpZGVkIHdoZW4gYm9vc3RyYXBwaW5nIHVzaW5nIEROU2BcblxuICAgICAgICAgIGRuc19yZXNvbHZlIEAgc3dpbV9ob3N0cywgKGVyciwgaG9zdHMpID0+IDo6XG4gICAgICAgICAgICBpZiBlcnIgOjogcmV0dXJuIHJlamVjdChlcnIpXG4gICAgICAgICAgICBpZiBob3N0cyA6OlxuICAgICAgICAgICAgICBzd2ltX2hvc3RzID0gaG9zdHMubWFwIEAgaG9zdCA9PiBgJHtob3N0fToke3N3aW1fcG9ydH1gXG4gICAgICAgICAgICAgIGNhbGxiYWNrIEAgc3dpbSwgc3dpbV9ob3N0cywgKGVyciwgYW5zKSA9PlxuICAgICAgICAgICAgICAgIGVyciA/IHJlamVjdChlcnIpIDogcmVzb2x2ZShhbnMpXG4gICAgICAgICAgcmV0dXJuIHRoaXNcblxuICAgICAgICBlbHNlIGlmIEFycmF5LmlzQXJyYXkgQCBzd2ltX2hvc3RzIDo6XG4gICAgICAgICAgaWYgc3dpbV9wb3J0IDo6XG4gICAgICAgICAgICBzd2ltX2hvc3RzID0gc3dpbV9ob3N0cy5tYXAgQCBob3N0ID0+XG4gICAgICAgICAgICAgIGhvc3QuaW5jbHVkZXMoJzonKSA/IGhvc3QgOiBgJHtob3N0fToke3N3aW1fcG9ydH1gXG4gICAgICAgICAgY2FsbGJhY2sgQCBzd2ltLCBzd2ltX2hvc3RzLCAoZXJyLCBhbnMpID0+XG4gICAgICAgICAgICBlcnIgPyByZWplY3QoZXJyKSA6IHJlc29sdmUoYW5zKVxuICAgICAgICAgIHJldHVybiB0aGlzXG5cbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvciBAIGBVbmV4cGVjdGVkICdzd2ltX2hvc3RzJyBwYXJhbWV0ZXIgZm9ybWF0LmBcbiAgICAgIGNhdGNoIGVyciA6OiByZWplY3QoZXJyKVxuXG5cbiAgX2JpbmRTd2ltVXBkYXRlcyhzd2ltLCBieUlkKSA6OlxuICAgIGNvbnN0IHVwZGF0ZVByb3BzID0gQHt9IGJ5SWQ6IEA6IHZhbHVlOiBieUlkXG4gICAgY29uc3QgcHF1ZXVlID0gdGhpcy5wcm9taXNlUXVldWUgQCAoKSA9PiA6OlxuICAgICAgY29uc3QgdXBkYXRlcyA9IE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzIEAgW10sIHVwZGF0ZVByb3BzXG4gICAgICBjb25zdCBhbnMgPSBzbGVlcCgwLCB1cGRhdGVzKVxuICAgICAgYW5zLnVwZGF0ZXMgPSB1cGRhdGVzXG4gICAgICBmb3IgY29uc3Qgc3ViIG9mIHRoaXMuX3N1YnNjcmliZXJMaXN0IDo6XG4gICAgICAgIGFucy50aGVuKHN1YilcbiAgICAgIHJldHVybiBhbnNcblxuICAgIDo6XG4gICAgICBjb25zdCB7aG9zdCwgbWV0YX0gPSBzd2ltLm9wdHMubG9jYWxcbiAgICAgIF9vbl91cGRhdGVFbnRyeSBAIG1ldGEsICdzZWxmJywgaG9zdFxuXG4gICAgOjpcbiAgICAgIGNvbnN0IHN3aW1fc3RhdGVfbHV0ID0gdGhpcy5zd2ltX3N0YXRlX2x1dC5zbGljZSgpXG4gICAgICBzd2ltLm9uIEAgJ3VwZGF0ZScsIGV2dCA9PiA6OlxuICAgICAgICBfb25fdXBkYXRlRW50cnkgQCBldnQubWV0YSwgc3dpbV9zdGF0ZV9sdXRbZXZ0LnN0YXRlXSwgZXZ0Lmhvc3RcblxuICAgIGZ1bmN0aW9uIF9vbl91cGRhdGVFbnRyeShtZXRhLCBzd2ltX3N0YXRlLCBzd2ltX2hvc3QpIDo6XG4gICAgICBjb25zdCB7aWRfcm91dGVyLCBlY19wdWJfaWR9ID0gbWV0YVxuICAgICAgY29uc3QgY3VyID0gYnlJZC5nZXQoaWRfcm91dGVyKVxuICAgICAgaWYgdW5kZWZpbmVkICE9PSBjdXIgJiYgZWNfcHViX2lkICE9IGN1ci5lY19wdWJfaWQgOjpcbiAgICAgICAgcmV0dXJuIC8vIHJlZnVzZSB0byBvdmVycmlkZSBleGlzdGluZyBlbnRyaWVzIHdpdGggbWlzbWF0Y2hlZCBlY19wdWJfaWRcblxuICAgICAgY29uc3QgZW50cnkgPSBPYmplY3QuYXNzaWduIEAge30sIG1ldGEsIEB7fSBzd2ltX3N0YXRlLCBzd2ltX2hvc3QsIHN3aW1fdHM6IG5ldyBEYXRlKClcbiAgICAgIGJ5SWQuc2V0IEAgaWRfcm91dGVyLCBlbnRyeVxuICAgICAgcHF1ZXVlKCkudXBkYXRlcy5wdXNoIEAgZW50cnlcblxuXG4gIHJlZ2lzdGVyUm91dGVyRGlzY292ZXJ5KGh1YikgOjpcbiAgICBpZiBudWxsID09IGh1YiA6OiBodWIgPSB0aGlzLmh1YlxuXG4gICAgY29uc3QgcmVzb2x2ZVJvdXRlcklkID0gYXN5bmMgaWRfcm91dGVyID0+IDo6XG4gICAgICBjb25zdCBlbnRyeSA9IHRoaXMuYnlJZC5nZXQoaWRfcm91dGVyKVxuICAgICAgaWYgdW5kZWZpbmVkID09PSBlbnRyeSA6OiByZXR1cm5cblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGNvbnN0IGNoYW4gPSBhd2FpdCBodWIuY29ubmVjdCBAIGVudHJ5LmNoYW5uZWxcbiAgICAgICAgcmV0dXJuIGNoYW4uc2VuZFJhd1xuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIHRoaXMuYnlJZC5kZWxldGUoaWRfcm91dGVyKVxuICAgICAgICBpZiBlcnIgJiYgJ0VDT05OUkVGVVNFRCcgIT09IGVyci5jb2RlIDo6XG4gICAgICAgICAgdGhyb3cgZXJyIC8vIHJlLXRocm93IGlmIG5vdCByZWNvZ25pemVkXG5cbiAgICBodWIucm91dGVyLnJvdXRlRGlzY292ZXJ5LnB1c2ggQCByZXNvbHZlUm91dGVySWRcbiAgICByZXR1cm4gdGhpc1xuXG5cbiAgX3N1YnNjcmliZXJMaXN0ID0gW11cbiAgc3Vic2NyaWJlKGNhbGxiYWNrKSA6OlxuICAgIHRoaXMuX3N1YnNjcmliZXJMaXN0LnB1c2ggQCBjYWxsYmFja1xuICAgIHJldHVybiB0aGlzXG5cbnN3aW1fcGx1Z2luLlN3aW1EaXNjb3ZlcnkgPSBTd2ltRGlzY292ZXJ5XG5PYmplY3QuYXNzaWduIEAgU3dpbURpc2NvdmVyeS5wcm90b3R5cGUsIEA6XG4gIHN3aW1fc3RhdGVfbHV0OiBAW10gJ2FsaXZlJywgJ3N1c3BlY3QnLCAnZGVhZCdcbiAgcHJvbWlzZVF1ZXVlXG5cblxuZnVuY3Rpb24gc2xlZXAobXMsIGN0eCkgOjpcbiAgcmV0dXJuIG5ldyBQcm9taXNlIEAgcmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zLCBjdHgpXG5cbmZ1bmN0aW9uIHByb21pc2VRdWV1ZShuZXh0UHJvbWlzZSkgOjpcbiAgbGV0IHRpcCA9IG51bGxcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIDo6XG4gICAgaWYgbnVsbCA9PT0gdGlwIDo6XG4gICAgICB0aXAgPSBuZXh0UHJvbWlzZSgpXG4gICAgICB0aXAudGhlbiBAIGNsZWFyX3RpcFxuICAgIHJldHVybiB0aXBcblxuICBmdW5jdGlvbiBjbGVhcl90aXAoKSA6OlxuICAgIHRpcCA9IG51bGxcblxuIl0sIm5hbWVzIjpbInRzXzIwMTVfZXBvY2giLCJzd2ltX3BsdWdpbiIsImRlZmF1bHRfb3B0aW9ucyIsInBsdWdpbl9vcHRpb25zIiwiT2JqZWN0IiwiYXNzaWduIiwiaHViIiwiY3JlYXRlU1dJTSIsImFzc2lnblNXSU1NZXRhIiwibWV0YSIsImFyZ3MiLCJpZF9zZWxmIiwiaWRfcm91dGVyIiwiZWNfcHViX2lkIiwicm91dGVyIiwiaWRfaW5mbyIsInRvU3RyaW5nIiwiaG9zdCIsImNoYW5uZWwiLCJzd2ltX3BvcnQiLCJpbmNhcm5hdGlvbiIsImNvbm5faW5mbyIsImlwX3NlcnZlciIsImlwX2xvY2FsIiwiYXNVUkwiLCJhZGRyZXNzIiwiRXJyb3IiLCJEYXRlIiwibm93Iiwic3dpbV9vcHRzIiwic3dpbV9jb25maWciLCJsb2NhbCIsInN3aW0iLCJTV0lNIiwiU3dpbURpc2NvdmVyeSIsIl9zdWJzY3JpYmVyTGlzdCIsImJ5SWQiLCJNYXAiLCJkZWZpbmVQcm9wZXJ0aWVzIiwidmFsdWUiLCJfYmluZFN3aW1VcGRhdGVzIiwibG9jYWxob3N0Iiwic3dpbV9ob3N0cyIsIl9wZXJmb3JtX3dpdGhfc3dpbV9ob3N0cyIsImNhbGxiYWNrIiwiYm9vdHN0cmFwIiwiam9pbiIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiVHlwZUVycm9yIiwiZXJyIiwiaG9zdHMiLCJtYXAiLCJhbnMiLCJBcnJheSIsImlzQXJyYXkiLCJpbmNsdWRlcyIsInVwZGF0ZVByb3BzIiwicHF1ZXVlIiwicHJvbWlzZVF1ZXVlIiwidXBkYXRlcyIsInNsZWVwIiwic3ViIiwidGhlbiIsIm9wdHMiLCJzd2ltX3N0YXRlX2x1dCIsInNsaWNlIiwib24iLCJldnQiLCJzdGF0ZSIsIl9vbl91cGRhdGVFbnRyeSIsInN3aW1fc3RhdGUiLCJzd2ltX2hvc3QiLCJjdXIiLCJnZXQiLCJ1bmRlZmluZWQiLCJlbnRyeSIsInN3aW1fdHMiLCJzZXQiLCJwdXNoIiwicmVzb2x2ZVJvdXRlcklkIiwiY2hhbiIsImNvbm5lY3QiLCJzZW5kUmF3IiwiZGVsZXRlIiwiY29kZSIsInJvdXRlRGlzY292ZXJ5IiwicHJvdG90eXBlIiwibXMiLCJjdHgiLCJzZXRUaW1lb3V0IiwibmV4dFByb21pc2UiLCJ0aXAiLCJjbGVhcl90aXAiXSwibWFwcGluZ3MiOiI7OztBQUdBLE1BQU1BLGdCQUFnQixhQUF0Qjs7QUFFQUMsWUFBWUMsZUFBWixHQUE4QjthQUNqQixJQURpQjtlQUVmO2NBQ0QsR0FEQztpQkFFRSxHQUZGO2lCQUdFLEVBSEY7b0JBSUssRUFKTDtzQkFLTyxDQUxQLEVBRmUsRUFBOUI7O0FBU0EsQUFBZSxTQUFTRCxXQUFULENBQXFCRSxjQUFyQixFQUFxQzttQkFDakNDLE9BQU9DLE1BQVAsQ0FBZ0IsRUFBaEIsRUFBb0JKLFlBQVlDLGVBQWhDLEVBQWlEQyxjQUFqRCxDQUFqQjs7U0FFTyxV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
