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

          dns.resolve(swim_hosts, (err, hosts) => {
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

module.exports = swim_plugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3dpbV9kaXNjb3ZlcnkuanMiLCJzb3VyY2VzIjpbIi4uL2NvZGUvc3dpbV9kaXNjb3ZlcnkuanN5Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7cmVzb2x2ZSBhcyBkbnNfcmVzb2x2ZX0gZnJvbSAnZG5zJ1xuaW1wb3J0IFNXSU0gZnJvbSAnc3dpbSdcblxuY29uc3QgdHNfMjAxNV9lcG9jaCA9IDE0MjAwNzA0MDAwMDAgLy8gbmV3IERhdGUoJzIwMTUtMDEtMDFUMDA6MDA6MDAuMDAwWicpLnZhbHVlT2YoKVxuXG5zd2ltX3BsdWdpbi5kZWZhdWx0X29wdGlvbnMgPSBAe31cbiAgc3dpbV9wb3J0OiAyNzAwXG4gIHN3aW1fY29uZmlnOiBAe31cbiAgICBpbnRlcnZhbDogMTAwXG4gICAgam9pblRpbWVvdXQ6IDMwMFxuICAgIHBpbmdUaW1lb3V0OiAzMFxuICAgIHBpbmdSZXFUaW1lb3V0OiA4MFxuICAgIHBpbmdSZXFHcm91cFNpemU6IDJcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc3dpbV9wbHVnaW4ocGx1Z2luX29wdGlvbnMpIDo6XG4gIHBsdWdpbl9vcHRpb25zID0gT2JqZWN0LmFzc2lnbiBAIHt9LCBzd2ltX3BsdWdpbi5kZWZhdWx0X29wdGlvbnMsIHBsdWdpbl9vcHRpb25zXG5cbiAgcmV0dXJuIGZ1bmN0aW9uIChodWIpIDo6XG4gICAgaHViLmNyZWF0ZVNXSU0gPSBjcmVhdGVTV0lNXG5cbiAgICBmdW5jdGlvbiBhc3NpZ25TV0lNTWV0YShtZXRhLCAuLi5hcmdzKSA6OlxuICAgICAgY29uc3Qge2lkX3NlbGY6IGlkX3JvdXRlciwgZWNfcHViX2lkfSA9IGh1Yi5yb3V0ZXJcbiAgICAgIGNvbnN0IGlkX2luZm8gPSBlY19wdWJfaWQgXG4gICAgICAgID8gQHt9IGlkX3JvdXRlclxuICAgICAgICAgICAgICBlY19wdWJfaWQ6IGVjX3B1Yl9pZC50b1N0cmluZygnYmFzZTY0JylcbiAgICAgICAgOiBAe30gaWRfcm91dGVyXG5cbiAgICAgIHJldHVybiBPYmplY3QuYXNzaWduIEAge30sIG1ldGEsIC4uLmFyZ3MsIGlkX2luZm9cblxuICAgIGZ1bmN0aW9uIGNyZWF0ZVNXSU0oe2hvc3QsIG1ldGEsIGNoYW5uZWwsIHN3aW1fcG9ydCwgaW5jYXJuYXRpb259KSA6OlxuICAgICAgbGV0IGNvbm5faW5mbyA9ICdmdW5jdGlvbicgPT09IHR5cGVvZiBjaGFubmVsIFxuICAgICAgICA/IGNoYW5uZWwgOiBjaGFubmVsLmNvbm5faW5mb1xuICAgICAgaWYgY29ubl9pbmZvIDo6XG4gICAgICAgIGNvbnN0IHtpcF9zZXJ2ZXIsIGlwX2xvY2FsfSA9IGNvbm5faW5mbygpXG4gICAgICAgIGNoYW5uZWwgPSAoaXBfc2VydmVyIHx8IGlwX2xvY2FsKS5hc1VSTCgpXG4gICAgICAgIGlmICEgaG9zdCA6OlxuICAgICAgICAgIGlmICEgc3dpbV9wb3J0IDo6IHN3aW1fcG9ydCA9IHBsdWdpbl9vcHRpb25zLnN3aW1fcG9ydFxuICAgICAgICAgIGhvc3QgPSBgJHsoaXBfc2VydmVyIHx8IGlwX2xvY2FsKS5hZGRyZXNzfToke3N3aW1fcG9ydH1gXG5cbiAgICAgIGlmICEgaG9zdCA6OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IgQCBgU1dJTSBwYWNrYWdlIHJlcXVpcmVzIGEgdmFsaWQgXCJob3N0XCIgcGFyYW1ldGVyYFxuICAgICAgaWYgbnVsbCA9PSBpbmNhcm5hdGlvbiA6OlxuICAgICAgICAvLyB1c2UgYSByb3VnaCB0aW1lLWJhc2VkIGluY2FybmF0aW9uIHRvIGhlbHAgd2l0aCByZXVzaW5nIGlwL3BvcnRcbiAgICAgICAgaW5jYXJuYXRpb24gPSBEYXRlLm5vdygpIC0gdHNfMjAxNV9lcG9jaFxuXG4gICAgICBtZXRhID0gYXNzaWduU1dJTU1ldGEgQCBtZXRhLCBjaGFubmVsICYmIEB7fSBjaGFubmVsXG4gICAgICBjb25zdCBzd2ltX29wdHMgPSBPYmplY3QuYXNzaWduIEBcbiAgICAgICAge30sIHBsdWdpbl9vcHRpb25zLnN3aW1fY29uZmlnXG4gICAgICAgIEA6IGxvY2FsOiBAe30gaG9zdCwgbWV0YSwgaW5jYXJuYXRpb25cblxuICAgICAgY29uc3Qgc3dpbSA9IG5ldyBTV0lNIEAgc3dpbV9vcHRzXG4gICAgICByZXR1cm4gbmV3IHN3aW1fcGx1Z2luLlN3aW1EaXNjb3ZlcnkgQCBodWIsIHN3aW1cblxuXG5cbmNsYXNzIFN3aW1EaXNjb3ZlcnkgOjpcbiAgY29uc3RydWN0b3IoaHViLCBzd2ltKSA6OlxuICAgIGNvbnN0IGJ5SWQgPSBuZXcgTWFwKClcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyBAIHRoaXMsIEA6XG4gICAgICBodWI6IEA6IHZhbHVlOiBodWJcbiAgICAgIHN3aW06IEA6IHZhbHVlOiBzd2ltXG4gICAgICBieUlkOiBAOiB2YWx1ZTogYnlJZFxuXG4gICAgdGhpcy5fYmluZFN3aW1VcGRhdGVzKHN3aW0sIGJ5SWQpXG5cbiAgbG9jYWxob3N0KCkgOjogcmV0dXJuIHRoaXMuc3dpbS5sb2NhbGhvc3QoKVxuXG4gIGJvb3RzdHJhcChzd2ltX2hvc3RzPVtdLCBzd2ltX3BvcnQpIDo6XG4gICAgcmV0dXJuIHRoaXMuX3BlcmZvcm1fd2l0aF9zd2ltX2hvc3RzIEAgc3dpbV9ob3N0cywgc3dpbV9wb3J0XG4gICAgICAoc3dpbSwgc3dpbV9ob3N0cywgY2FsbGJhY2spID0+IHN3aW0uYm9vdHN0cmFwKHN3aW1faG9zdHMsIGNhbGxiYWNrKVxuXG4gIGpvaW4oc3dpbV9ob3N0cz1bXSwgc3dpbV9wb3J0KSA6OlxuICAgIHJldHVybiB0aGlzLl9wZXJmb3JtX3dpdGhfc3dpbV9ob3N0cyBAIHN3aW1faG9zdHMsIHN3aW1fcG9ydFxuICAgICAgKHN3aW0sIHN3aW1faG9zdHMsIGNhbGxiYWNrKSA9PiBzd2ltLmpvaW4oc3dpbV9ob3N0cywgY2FsbGJhY2spXG5cbiAgX3BlcmZvcm1fd2l0aF9zd2ltX2hvc3RzKHN3aW1faG9zdHMsIHN3aW1fcG9ydCwgY2FsbGJhY2spIDo6XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlIEAgKHJlc29sdmUsIHJlamVjdCkgPT4gOjpcbiAgICAgIHRyeSA6OlxuICAgICAgICBjb25zdCBzd2ltID0gdGhpcy5zd2ltXG4gICAgICAgIGlmICdzdHJpbmcnID09PSB0eXBlb2Ygc3dpbV9ob3N0cyA6OlxuICAgICAgICAgIGlmICEgc3dpbV9wb3J0IDo6XG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yIEAgYCdzd2ltX3BvcnQnIG11c3QgYmUgcHJvdmlkZWQgd2hlbiBib29zdHJhcHBpbmcgdXNpbmcgRE5TYFxuXG4gICAgICAgICAgZG5zX3Jlc29sdmUgQCBzd2ltX2hvc3RzLCAoZXJyLCBob3N0cykgPT4gOjpcbiAgICAgICAgICAgIGlmIGVyciA6OiByZXR1cm4gcmVqZWN0KGVycilcbiAgICAgICAgICAgIGlmIGhvc3RzIDo6XG4gICAgICAgICAgICAgIHN3aW1faG9zdHMgPSBob3N0cy5tYXAgQCBob3N0ID0+IGAke2hvc3R9OiR7c3dpbV9wb3J0fWBcbiAgICAgICAgICAgICAgY2FsbGJhY2sgQCBzd2ltLCBzd2ltX2hvc3RzLCAoZXJyLCBhbnMpID0+XG4gICAgICAgICAgICAgICAgZXJyID8gcmVqZWN0KGVycikgOiByZXNvbHZlKGFucylcbiAgICAgICAgICByZXR1cm4gdGhpc1xuXG4gICAgICAgIGVsc2UgaWYgQXJyYXkuaXNBcnJheSBAIHN3aW1faG9zdHMgOjpcbiAgICAgICAgICBpZiBzd2ltX3BvcnQgOjpcbiAgICAgICAgICAgIHN3aW1faG9zdHMgPSBzd2ltX2hvc3RzLm1hcCBAIGhvc3QgPT5cbiAgICAgICAgICAgICAgaG9zdC5pbmNsdWRlcygnOicpID8gaG9zdCA6IGAke2hvc3R9OiR7c3dpbV9wb3J0fWBcbiAgICAgICAgICBjYWxsYmFjayBAIHN3aW0sIHN3aW1faG9zdHMsIChlcnIsIGFucykgPT5cbiAgICAgICAgICAgIGVyciA/IHJlamVjdChlcnIpIDogcmVzb2x2ZShhbnMpXG4gICAgICAgICAgcmV0dXJuIHRoaXNcblxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yIEAgYFVuZXhwZWN0ZWQgJ3N3aW1faG9zdHMnIHBhcmFtZXRlciBmb3JtYXQuYFxuICAgICAgY2F0Y2ggZXJyIDo6IHJlamVjdChlcnIpXG5cblxuICBfYmluZFN3aW1VcGRhdGVzKHN3aW0sIGJ5SWQpIDo6XG4gICAgY29uc3QgdXBkYXRlUHJvcHMgPSBAe30gYnlJZDogQDogdmFsdWU6IGJ5SWRcbiAgICBjb25zdCBwcXVldWUgPSB0aGlzLnByb21pc2VRdWV1ZSBAICgpID0+IDo6XG4gICAgICBjb25zdCB1cGRhdGVzID0gT2JqZWN0LmRlZmluZVByb3BlcnRpZXMgQCBbXSwgdXBkYXRlUHJvcHNcbiAgICAgIGNvbnN0IGFucyA9IHNsZWVwKDAsIHVwZGF0ZXMpXG4gICAgICBhbnMudXBkYXRlcyA9IHVwZGF0ZXNcbiAgICAgIGZvciBjb25zdCBzdWIgb2YgdGhpcy5fc3Vic2NyaWJlckxpc3QgOjpcbiAgICAgICAgYW5zLnRoZW4oc3ViKVxuICAgICAgcmV0dXJuIGFuc1xuXG4gICAgOjpcbiAgICAgIGNvbnN0IHtob3N0LCBtZXRhfSA9IHN3aW0ub3B0cy5sb2NhbFxuICAgICAgX29uX3VwZGF0ZUVudHJ5IEAgbWV0YSwgJ3NlbGYnLCBob3N0XG5cbiAgICA6OlxuICAgICAgY29uc3Qgc3dpbV9zdGF0ZV9sdXQgPSB0aGlzLnN3aW1fc3RhdGVfbHV0LnNsaWNlKClcbiAgICAgIHN3aW0ub24gQCAndXBkYXRlJywgZXZ0ID0+IDo6XG4gICAgICAgIF9vbl91cGRhdGVFbnRyeSBAIGV2dC5tZXRhLCBzd2ltX3N0YXRlX2x1dFtldnQuc3RhdGVdLCBldnQuaG9zdFxuXG4gICAgZnVuY3Rpb24gX29uX3VwZGF0ZUVudHJ5KG1ldGEsIHN3aW1fc3RhdGUsIHN3aW1faG9zdCkgOjpcbiAgICAgIGNvbnN0IHtpZF9yb3V0ZXIsIGVjX3B1Yl9pZH0gPSBtZXRhXG4gICAgICBjb25zdCBjdXIgPSBieUlkLmdldChpZF9yb3V0ZXIpXG4gICAgICBpZiB1bmRlZmluZWQgIT09IGN1ciAmJiBlY19wdWJfaWQgIT0gY3VyLmVjX3B1Yl9pZCA6OlxuICAgICAgICByZXR1cm4gLy8gcmVmdXNlIHRvIG92ZXJyaWRlIGV4aXN0aW5nIGVudHJpZXMgd2l0aCBtaXNtYXRjaGVkIGVjX3B1Yl9pZFxuXG4gICAgICBjb25zdCBlbnRyeSA9IE9iamVjdC5hc3NpZ24gQCB7fSwgbWV0YSwgQHt9IHN3aW1fc3RhdGUsIHN3aW1faG9zdCwgc3dpbV90czogbmV3IERhdGUoKVxuICAgICAgYnlJZC5zZXQgQCBpZF9yb3V0ZXIsIGVudHJ5XG4gICAgICBwcXVldWUoKS51cGRhdGVzLnB1c2ggQCBlbnRyeVxuXG5cbiAgcmVnaXN0ZXJSb3V0ZXJEaXNjb3ZlcnkoaHViKSA6OlxuICAgIGlmIG51bGwgPT0gaHViIDo6IGh1YiA9IHRoaXMuaHViXG5cbiAgICBjb25zdCByZXNvbHZlUm91dGVySWQgPSBhc3luYyBpZF9yb3V0ZXIgPT4gOjpcbiAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy5ieUlkLmdldChpZF9yb3V0ZXIpXG4gICAgICBpZiB1bmRlZmluZWQgPT09IGVudHJ5IDo6IHJldHVyblxuXG4gICAgICB0cnkgOjpcbiAgICAgICAgY29uc3QgY2hhbiA9IGF3YWl0IGh1Yi5jb25uZWN0IEAgZW50cnkuY2hhbm5lbFxuICAgICAgICByZXR1cm4gY2hhbi5zZW5kUmF3XG4gICAgICBjYXRjaCBlcnIgOjpcbiAgICAgICAgdGhpcy5ieUlkLmRlbGV0ZShpZF9yb3V0ZXIpXG4gICAgICAgIGlmIGVyciAmJiAnRUNPTk5SRUZVU0VEJyAhPT0gZXJyLmNvZGUgOjpcbiAgICAgICAgICB0aHJvdyBlcnIgLy8gcmUtdGhyb3cgaWYgbm90IHJlY29nbml6ZWRcblxuICAgIGh1Yi5yb3V0ZXIucm91dGVEaXNjb3ZlcnkucHVzaCBAIHJlc29sdmVSb3V0ZXJJZFxuICAgIHJldHVybiB0aGlzXG5cblxuICBfc3Vic2NyaWJlckxpc3QgPSBbXVxuICBzdWJzY3JpYmUoY2FsbGJhY2spIDo6XG4gICAgdGhpcy5fc3Vic2NyaWJlckxpc3QucHVzaCBAIGNhbGxiYWNrXG4gICAgcmV0dXJuIHRoaXNcblxuc3dpbV9wbHVnaW4uU3dpbURpc2NvdmVyeSA9IFN3aW1EaXNjb3Zlcnlcbk9iamVjdC5hc3NpZ24gQCBTd2ltRGlzY292ZXJ5LnByb3RvdHlwZSwgQDpcbiAgc3dpbV9zdGF0ZV9sdXQ6IEBbXSAnYWxpdmUnLCAnc3VzcGVjdCcsICdkZWFkJ1xuICBwcm9taXNlUXVldWVcblxuXG5mdW5jdGlvbiBzbGVlcChtcywgY3R4KSA6OlxuICByZXR1cm4gbmV3IFByb21pc2UgQCByZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMsIGN0eClcblxuZnVuY3Rpb24gcHJvbWlzZVF1ZXVlKG5leHRQcm9taXNlKSA6OlxuICBsZXQgdGlwID0gbnVsbFxuICByZXR1cm4gZnVuY3Rpb24gKCkgOjpcbiAgICBpZiBudWxsID09PSB0aXAgOjpcbiAgICAgIHRpcCA9IG5leHRQcm9taXNlKClcbiAgICAgIHRpcC50aGVuIEAgY2xlYXJfdGlwXG4gICAgcmV0dXJuIHRpcFxuXG4gIGZ1bmN0aW9uIGNsZWFyX3RpcCgpIDo6XG4gICAgdGlwID0gbnVsbFxuXG4iXSwibmFtZXMiOlsidHNfMjAxNV9lcG9jaCIsInN3aW1fcGx1Z2luIiwiZGVmYXVsdF9vcHRpb25zIiwicGx1Z2luX29wdGlvbnMiLCJPYmplY3QiLCJhc3NpZ24iLCJodWIiLCJjcmVhdGVTV0lNIiwiYXNzaWduU1dJTU1ldGEiLCJtZXRhIiwiYXJncyIsImlkX3NlbGYiLCJpZF9yb3V0ZXIiLCJlY19wdWJfaWQiLCJyb3V0ZXIiLCJpZF9pbmZvIiwidG9TdHJpbmciLCJob3N0IiwiY2hhbm5lbCIsInN3aW1fcG9ydCIsImluY2FybmF0aW9uIiwiY29ubl9pbmZvIiwiaXBfc2VydmVyIiwiaXBfbG9jYWwiLCJhc1VSTCIsImFkZHJlc3MiLCJFcnJvciIsIkRhdGUiLCJub3ciLCJzd2ltX29wdHMiLCJzd2ltX2NvbmZpZyIsImxvY2FsIiwic3dpbSIsIlNXSU0iLCJTd2ltRGlzY292ZXJ5IiwiX3N1YnNjcmliZXJMaXN0IiwiYnlJZCIsIk1hcCIsImRlZmluZVByb3BlcnRpZXMiLCJ2YWx1ZSIsIl9iaW5kU3dpbVVwZGF0ZXMiLCJsb2NhbGhvc3QiLCJzd2ltX2hvc3RzIiwiX3BlcmZvcm1fd2l0aF9zd2ltX2hvc3RzIiwiY2FsbGJhY2siLCJib290c3RyYXAiLCJqb2luIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJUeXBlRXJyb3IiLCJlcnIiLCJob3N0cyIsIm1hcCIsImFucyIsIkFycmF5IiwiaXNBcnJheSIsImluY2x1ZGVzIiwidXBkYXRlUHJvcHMiLCJwcXVldWUiLCJwcm9taXNlUXVldWUiLCJ1cGRhdGVzIiwic2xlZXAiLCJzdWIiLCJ0aGVuIiwib3B0cyIsInN3aW1fc3RhdGVfbHV0Iiwic2xpY2UiLCJvbiIsImV2dCIsInN0YXRlIiwiX29uX3VwZGF0ZUVudHJ5Iiwic3dpbV9zdGF0ZSIsInN3aW1faG9zdCIsImN1ciIsImdldCIsInVuZGVmaW5lZCIsImVudHJ5Iiwic3dpbV90cyIsInNldCIsInB1c2giLCJyZXNvbHZlUm91dGVySWQiLCJjaGFuIiwiY29ubmVjdCIsInNlbmRSYXciLCJkZWxldGUiLCJjb2RlIiwicm91dGVEaXNjb3ZlcnkiLCJwcm90b3R5cGUiLCJtcyIsImN0eCIsInNldFRpbWVvdXQiLCJuZXh0UHJvbWlzZSIsInRpcCIsImNsZWFyX3RpcCJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUdBLE1BQU1BLGdCQUFnQixhQUF0Qjs7QUFFQUMsWUFBWUMsZUFBWixHQUE4QjthQUNqQixJQURpQjtlQUVmO2NBQ0QsR0FEQztpQkFFRSxHQUZGO2lCQUdFLEVBSEY7b0JBSUssRUFKTDtzQkFLTyxDQUxQLEVBRmUsRUFBOUI7O0FBU0EsQUFBZSxTQUFTRCxXQUFULENBQXFCRSxjQUFyQixFQUFxQzttQkFDakNDLE9BQU9DLE1BQVAsQ0FBZ0IsRUFBaEIsRUFBb0JKLFlBQVlDLGVBQWhDLEVBQWlEQyxjQUFqRCxDQUFqQjs7U0FF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
