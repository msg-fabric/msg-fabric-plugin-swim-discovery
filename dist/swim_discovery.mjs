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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3dpbV9kaXNjb3ZlcnkubWpzIiwic291cmNlcyI6WyIuLi9jb2RlL3N3aW1fZGlzY292ZXJ5LmpzeSJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge3Jlc29sdmUgYXMgZG5zX3Jlc29sdmV9IGZyb20gJ2RucydcbmltcG9ydCBTV0lNIGZyb20gJ3N3aW0nXG5cbmNvbnN0IHRzXzIwMTVfZXBvY2ggPSAxNDIwMDcwNDAwMDAwIC8vIG5ldyBEYXRlKCcyMDE1LTAxLTAxVDAwOjAwOjAwLjAwMFonKS52YWx1ZU9mKClcblxuc3dpbV9wbHVnaW4uZGVmYXVsdF9vcHRpb25zID0gQHt9XG4gIHN3aW1fcG9ydDogMjcwMFxuICBzd2ltX2NvbmZpZzogQHt9XG4gICAgaW50ZXJ2YWw6IDEwMFxuICAgIGpvaW5UaW1lb3V0OiAzMDBcbiAgICBwaW5nVGltZW91dDogMzBcbiAgICBwaW5nUmVxVGltZW91dDogODBcbiAgICBwaW5nUmVxR3JvdXBTaXplOiAyXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHN3aW1fcGx1Z2luKHBsdWdpbl9vcHRpb25zKSA6OlxuICBwbHVnaW5fb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24gQCB7fSwgc3dpbV9wbHVnaW4uZGVmYXVsdF9vcHRpb25zLCBwbHVnaW5fb3B0aW9uc1xuXG4gIHJldHVybiBmdW5jdGlvbiAoaHViKSA6OlxuICAgIGh1Yi5jcmVhdGVTV0lNID0gY3JlYXRlU1dJTVxuXG4gICAgZnVuY3Rpb24gYXNzaWduU1dJTU1ldGEobWV0YSwgLi4uYXJncykgOjpcbiAgICAgIGNvbnN0IHtpZF9zZWxmOiBpZF9yb3V0ZXIsIGVjX3B1Yl9pZH0gPSBodWIucm91dGVyXG4gICAgICBjb25zdCBpZF9pbmZvID0gZWNfcHViX2lkIFxuICAgICAgICA/IEB7fSBpZF9yb3V0ZXJcbiAgICAgICAgICAgICAgZWNfcHViX2lkOiBlY19wdWJfaWQudG9TdHJpbmcoJ2Jhc2U2NCcpXG4gICAgICAgIDogQHt9IGlkX3JvdXRlclxuXG4gICAgICByZXR1cm4gT2JqZWN0LmFzc2lnbiBAIHt9LCBtZXRhLCAuLi5hcmdzLCBpZF9pbmZvXG5cbiAgICBmdW5jdGlvbiBjcmVhdGVTV0lNKHtob3N0LCBtZXRhLCBjaGFubmVsLCBzd2ltX3BvcnQsIGluY2FybmF0aW9ufSkgOjpcbiAgICAgIGxldCBjb25uX2luZm8gPSAnZnVuY3Rpb24nID09PSB0eXBlb2YgY2hhbm5lbCBcbiAgICAgICAgPyBjaGFubmVsIDogY2hhbm5lbC5jb25uX2luZm9cbiAgICAgIGlmIGNvbm5faW5mbyA6OlxuICAgICAgICBjb25zdCB7aXBfc2VydmVyLCBpcF9sb2NhbH0gPSBjb25uX2luZm8oKVxuICAgICAgICBjaGFubmVsID0gKGlwX3NlcnZlciB8fCBpcF9sb2NhbCkuYXNVUkwoKVxuICAgICAgICBpZiAhIGhvc3QgOjpcbiAgICAgICAgICBpZiAhIHN3aW1fcG9ydCA6OiBzd2ltX3BvcnQgPSBwbHVnaW5fb3B0aW9ucy5zd2ltX3BvcnRcbiAgICAgICAgICBob3N0ID0gYCR7KGlwX3NlcnZlciB8fCBpcF9sb2NhbCkuYWRkcmVzc306JHtzd2ltX3BvcnR9YFxuXG4gICAgICBpZiAhIGhvc3QgOjpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yIEAgYFNXSU0gcGFja2FnZSByZXF1aXJlcyBhIHZhbGlkIFwiaG9zdFwiIHBhcmFtZXRlcmBcbiAgICAgIGlmIG51bGwgPT0gaW5jYXJuYXRpb24gOjpcbiAgICAgICAgLy8gdXNlIGEgcm91Z2ggdGltZS1iYXNlZCBpbmNhcm5hdGlvbiB0byBoZWxwIHdpdGggcmV1c2luZyBpcC9wb3J0XG4gICAgICAgIGluY2FybmF0aW9uID0gRGF0ZS5ub3coKSAtIHRzXzIwMTVfZXBvY2hcblxuICAgICAgbWV0YSA9IGFzc2lnblNXSU1NZXRhIEAgbWV0YSwgY2hhbm5lbCAmJiBAe30gY2hhbm5lbFxuICAgICAgY29uc3Qgc3dpbV9vcHRzID0gT2JqZWN0LmFzc2lnbiBAXG4gICAgICAgIHt9LCBwbHVnaW5fb3B0aW9ucy5zd2ltX2NvbmZpZ1xuICAgICAgICBAOiBsb2NhbDogQHt9IGhvc3QsIG1ldGEsIGluY2FybmF0aW9uXG5cbiAgICAgIGNvbnN0IHN3aW0gPSBuZXcgU1dJTSBAIHN3aW1fb3B0c1xuICAgICAgcmV0dXJuIG5ldyBzd2ltX3BsdWdpbi5Td2ltRGlzY292ZXJ5IEAgaHViLCBzd2ltXG5cblxuXG5jbGFzcyBTd2ltRGlzY292ZXJ5IDo6XG4gIGNvbnN0cnVjdG9yKGh1Yiwgc3dpbSkgOjpcbiAgICBjb25zdCBieUlkID0gbmV3IE1hcCgpXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMgQCB0aGlzLCBAOlxuICAgICAgaHViOiBAOiB2YWx1ZTogaHViXG4gICAgICBzd2ltOiBAOiB2YWx1ZTogc3dpbVxuICAgICAgYnlJZDogQDogdmFsdWU6IGJ5SWRcblxuICAgIHRoaXMuX2JpbmRTd2ltVXBkYXRlcyhzd2ltLCBieUlkKVxuXG4gIGxvY2FsaG9zdCgpIDo6IHJldHVybiB0aGlzLnN3aW0ubG9jYWxob3N0KClcblxuICBib290c3RyYXAoc3dpbV9ob3N0cz1bXSwgc3dpbV9wb3J0KSA6OlxuICAgIGNvbnN0IHN3aW0gPSB0aGlzLnN3aW1cbiAgICBpZiAnc3RyaW5nJyA9PT0gdHlwZW9mIHN3aW1faG9zdHMgOjpcbiAgICAgIGRuc19yZXNvbHZlIEAgc3dpbV9ob3N0cywgKGVyciwgaG9zdHMpID0+IDo6XG4gICAgICAgIHN3aW1faG9zdHMgPSBob3N0cy5tYXAgQCBob3N0ID0+IGAke2hvc3R9OiR7c3dpbV9wb3J0fWBcbiAgICAgICAgc3dpbS5ib290c3RyYXAgQCBzd2ltX2hvc3RzXG4gICAgICByZXR1cm4gdGhpc1xuXG4gICAgZWxzZSBpZiBBcnJheS5pc0FycmF5IEAgc3dpbV9ob3N0cyA6OlxuICAgICAgaWYgc3dpbV9wb3J0IDo6XG4gICAgICAgIHN3aW1faG9zdHMgPSBzd2ltX2hvc3RzLm1hcCBAIGhvc3QgPT5cbiAgICAgICAgICBob3N0LmluY2x1ZGVzKCc6JykgPyBob3N0IDogYCR7aG9zdH06JHtzd2ltX3BvcnR9YFxuICAgICAgc3dpbS5ib290c3RyYXAgQCBzd2ltX2hvc3RzXG4gICAgICByZXR1cm4gdGhpc1xuXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvciBAIGBVbmV4cGVjdGVkICdzd2ltX2hvc3RzJyBwYXJhbWV0ZXIgZm9ybWF0LmBcblxuXG4gIF9iaW5kU3dpbVVwZGF0ZXMoc3dpbSwgYnlJZCkgOjpcbiAgICBjb25zdCB1cGRhdGVQcm9wcyA9IEB7fSBieUlkOiBAOiB2YWx1ZTogYnlJZFxuICAgIGNvbnN0IHBxdWV1ZSA9IHRoaXMucHJvbWlzZVF1ZXVlIEAgKCkgPT4gOjpcbiAgICAgIGNvbnN0IHVwZGF0ZXMgPSBPYmplY3QuZGVmaW5lUHJvcGVydGllcyBAIFtdLCB1cGRhdGVQcm9wc1xuICAgICAgY29uc3QgYW5zID0gc2xlZXAoMCwgdXBkYXRlcylcbiAgICAgIGFucy51cGRhdGVzID0gdXBkYXRlc1xuICAgICAgZm9yIGNvbnN0IHN1YiBvZiB0aGlzLl9zdWJzY3JpYmVyTGlzdCA6OlxuICAgICAgICBhbnMudGhlbihzdWIpXG4gICAgICByZXR1cm4gYW5zXG5cbiAgICA6OlxuICAgICAgY29uc3Qge2hvc3QsIG1ldGF9ID0gc3dpbS5vcHRzLmxvY2FsXG4gICAgICBfb25fdXBkYXRlRW50cnkgQCBtZXRhLCAnc2VsZicsIGhvc3RcblxuICAgIDo6XG4gICAgICBjb25zdCBzd2ltX3N0YXRlX2x1dCA9IHRoaXMuc3dpbV9zdGF0ZV9sdXQuc2xpY2UoKVxuICAgICAgc3dpbS5vbiBAICd1cGRhdGUnLCBldnQgPT4gOjpcbiAgICAgICAgX29uX3VwZGF0ZUVudHJ5IEAgZXZ0Lm1ldGEsIHN3aW1fc3RhdGVfbHV0W2V2dC5zdGF0ZV0sIGV2dC5ob3N0XG5cbiAgICBmdW5jdGlvbiBfb25fdXBkYXRlRW50cnkobWV0YSwgc3dpbV9zdGF0ZSwgc3dpbV9ob3N0KSA6OlxuICAgICAgY29uc3Qge2lkX3JvdXRlciwgZWNfcHViX2lkfSA9IG1ldGFcbiAgICAgIGNvbnN0IGN1ciA9IGJ5SWQuZ2V0KGlkX3JvdXRlcilcbiAgICAgIGlmIHVuZGVmaW5lZCAhPT0gY3VyICYmIGVjX3B1Yl9pZCAhPSBjdXIuZWNfcHViX2lkIDo6XG4gICAgICAgIHJldHVybiAvLyByZWZ1c2UgdG8gb3ZlcnJpZGUgZXhpc3RpbmcgZW50cmllcyB3aXRoIG1pc21hdGNoZWQgZWNfcHViX2lkXG5cbiAgICAgIGNvbnN0IGVudHJ5ID0gT2JqZWN0LmFzc2lnbiBAIHt9LCBtZXRhLCBAe30gc3dpbV9zdGF0ZSwgc3dpbV9ob3N0LCBzd2ltX3RzOiBuZXcgRGF0ZSgpXG4gICAgICBieUlkLnNldCBAIGlkX3JvdXRlciwgZW50cnlcbiAgICAgIHBxdWV1ZSgpLnVwZGF0ZXMucHVzaCBAIGVudHJ5XG5cblxuICByZWdpc3RlclJvdXRlckRpc2NvdmVyeShodWIpIDo6XG4gICAgaWYgbnVsbCA9PSBodWIgOjogaHViID0gdGhpcy5odWJcblxuICAgIGNvbnN0IHJlc29sdmVSb3V0ZXJJZCA9IGFzeW5jIGlkX3JvdXRlciA9PiA6OlxuICAgICAgY29uc3QgZW50cnkgPSB0aGlzLmJ5SWQuZ2V0KGlkX3JvdXRlcilcbiAgICAgIGlmIHVuZGVmaW5lZCA9PT0gZW50cnkgOjogcmV0dXJuXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBjb25zdCBjaGFuID0gYXdhaXQgaHViLmNvbm5lY3QgQCBlbnRyeS5jaGFubmVsXG4gICAgICAgIHJldHVybiBjaGFuLnNlbmRSYXdcbiAgICAgIGNhdGNoIGVyciA6OlxuICAgICAgICB0aGlzLmJ5SWQuZGVsZXRlKGlkX3JvdXRlcilcbiAgICAgICAgaWYgZXJyICYmICdFQ09OTlJFRlVTRUQnICE9PSBlcnIuY29kZSA6OlxuICAgICAgICAgIHRocm93IGVyciAvLyByZS10aHJvdyBpZiBub3QgcmVjb2duaXplZFxuXG4gICAgaHViLnJvdXRlci5yb3V0ZURpc2NvdmVyeS5wdXNoIEAgcmVzb2x2ZVJvdXRlcklkXG4gICAgcmV0dXJuIHRoaXNcblxuXG4gIF9zdWJzY3JpYmVyTGlzdCA9IFtdXG4gIHN1YnNjcmliZShjYWxsYmFjaykgOjpcbiAgICB0aGlzLl9zdWJzY3JpYmVyTGlzdC5wdXNoIEAgY2FsbGJhY2tcbiAgICByZXR1cm4gdGhpc1xuXG5zd2ltX3BsdWdpbi5Td2ltRGlzY292ZXJ5ID0gU3dpbURpc2NvdmVyeVxuT2JqZWN0LmFzc2lnbiBAIFN3aW1EaXNjb3ZlcnkucHJvdG90eXBlLCBAOlxuICBzd2ltX3N0YXRlX2x1dDogQFtdICdhbGl2ZScsICdzdXNwZWN0JywgJ2RlYWQnXG4gIHByb21pc2VRdWV1ZVxuXG5cbmZ1bmN0aW9uIHNsZWVwKG1zLCBjdHgpIDo6XG4gIHJldHVybiBuZXcgUHJvbWlzZSBAIHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcywgY3R4KVxuXG5mdW5jdGlvbiBwcm9taXNlUXVldWUobmV4dFByb21pc2UpIDo6XG4gIGxldCB0aXAgPSBudWxsXG4gIHJldHVybiBmdW5jdGlvbiAoKSA6OlxuICAgIGlmIG51bGwgPT09IHRpcCA6OlxuICAgICAgdGlwID0gbmV4dFByb21pc2UoKVxuICAgICAgdGlwLnRoZW4gQCBjbGVhcl90aXBcbiAgICByZXR1cm4gdGlwXG5cbiAgZnVuY3Rpb24gY2xlYXJfdGlwKCkgOjpcbiAgICB0aXAgPSBudWxsXG5cbiJdLCJuYW1lcyI6WyJ0c18yMDE1X2Vwb2NoIiwic3dpbV9wbHVnaW4iLCJkZWZhdWx0X29wdGlvbnMiLCJwbHVnaW5fb3B0aW9ucyIsIk9iamVjdCIsImFzc2lnbiIsImh1YiIsImNyZWF0ZVNXSU0iLCJhc3NpZ25TV0lNTWV0YSIsIm1ldGEiLCJhcmdzIiwiaWRfc2VsZiIsImlkX3JvdXRlciIsImVjX3B1Yl9pZCIsInJvdXRlciIsImlkX2luZm8iLCJ0b1N0cmluZyIsImhvc3QiLCJjaGFubmVsIiwic3dpbV9wb3J0IiwiaW5jYXJuYXRpb24iLCJjb25uX2luZm8iLCJpcF9zZXJ2ZXIiLCJpcF9sb2NhbCIsImFzVVJMIiwiYWRkcmVzcyIsIkVycm9yIiwiRGF0ZSIsIm5vdyIsInN3aW1fb3B0cyIsInN3aW1fY29uZmlnIiwibG9jYWwiLCJzd2ltIiwiU1dJTSIsIlN3aW1EaXNjb3ZlcnkiLCJfc3Vic2NyaWJlckxpc3QiLCJieUlkIiwiTWFwIiwiZGVmaW5lUHJvcGVydGllcyIsInZhbHVlIiwiX2JpbmRTd2ltVXBkYXRlcyIsImxvY2FsaG9zdCIsInN3aW1faG9zdHMiLCJlcnIiLCJob3N0cyIsIm1hcCIsImJvb3RzdHJhcCIsIkFycmF5IiwiaXNBcnJheSIsImluY2x1ZGVzIiwiVHlwZUVycm9yIiwidXBkYXRlUHJvcHMiLCJwcXVldWUiLCJwcm9taXNlUXVldWUiLCJ1cGRhdGVzIiwiYW5zIiwic2xlZXAiLCJzdWIiLCJ0aGVuIiwib3B0cyIsInN3aW1fc3RhdGVfbHV0Iiwic2xpY2UiLCJvbiIsImV2dCIsInN0YXRlIiwiX29uX3VwZGF0ZUVudHJ5Iiwic3dpbV9zdGF0ZSIsInN3aW1faG9zdCIsImN1ciIsImdldCIsInVuZGVmaW5lZCIsImVudHJ5Iiwic3dpbV90cyIsInNldCIsInB1c2giLCJyZXNvbHZlUm91dGVySWQiLCJjaGFuIiwiY29ubmVjdCIsInNlbmRSYXciLCJkZWxldGUiLCJjb2RlIiwicm91dGVEaXNjb3ZlcnkiLCJjYWxsYmFjayIsInByb3RvdHlwZSIsIm1zIiwiY3R4IiwiUHJvbWlzZSIsInJlc29sdmUiLCJzZXRUaW1lb3V0IiwibmV4dFByb21pc2UiLCJ0aXAiLCJjbGVhcl90aXAiXSwibWFwcGluZ3MiOiI7OztBQUdBLE1BQU1BLGdCQUFnQixhQUF0Qjs7QUFFQUMsWUFBWUMsZUFBWixHQUE4QjthQUNqQixJQURpQjtlQUVmO2NBQ0QsR0FEQztpQkFFRSxHQUZGO2lCQUdFLEVBSEY7b0JBSUssRUFKTDtzQkFLTyxDQUxQLEVBRmUsRUFBOUI7O0FBU0EsQUFBZSxTQUFTRCxXQUFULENBQXFCRSxjQUFyQixFQUFxQzttQkFDakNDLE9BQU9DLE1BQVAsQ0FBZ0IsRUFBaEIsRUFBb0JKLFlBQVlDLGVBQWhDLEVBQWlEQyxjQUFqRCxDQUFqQjs7U0FF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
