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
