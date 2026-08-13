const HealthConnection = require("../models/HealthConnection");
const HealthSyncState = require("../models/HealthSyncState");
const HealthSample = require("../models/HealthSample");
const HealthSleepSession = require("../models/HealthSleepSession");
const { HEALTH_SLEEP_RECORD_TYPE } = require("../constants/healthRecordTypes");

exports.getConnectionStatus = async (req, res) => {
  try {
    const connection = await HealthConnection.findOne({ user: req.user._id, connected: true });
    const syncState = await HealthSyncState.findOne({ user: req.user._id });

    res.status(200).json({
      connected: !!connection,
      connectedAt: connection?.connectedAt || null,
      grantedRecordTypes: connection?.grantedRecordTypes || [],
      syncState: {
        lastSyncedAt: syncState?.lastSyncedAt || null,
      },
    });
  } catch (error) {
    console.error("getConnectionStatus error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.connectHealth = async (req, res) => {
  try {
    const { grantedRecordTypes } = req.body;

    if (!Array.isArray(grantedRecordTypes) || grantedRecordTypes.length === 0) {
      return res.status(400).json({ message: "grantedRecordTypes is required" });
    }

    await HealthConnection.findOneAndUpdate(
      { user: req.user._id },
      {
        user: req.user._id,
        platform: "android",
        connected: true,
        connectedAt: new Date(),
        disconnectedAt: null,
        grantedRecordTypes,
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ message: "Health data connected" });
  } catch (error) {
    console.error("connectHealth error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.disconnectHealth = async (req, res) => {
  try {
    await HealthConnection.findOneAndUpdate(
      { user: req.user._id },
      { connected: false, disconnectedAt: new Date() }
    );

    // The sync cursor is intentionally cleared on disconnect (not just the
    // connection flag): if the user reconnects later, permissions may have
    // changed, and re-running the historical import is safer than resuming
    // from a stale token against a possibly different permission set.
    await HealthSyncState.deleteOne({ user: req.user._id });

    res.status(200).json({ message: "Health data disconnected" });
  } catch (error) {
    console.error("disconnectHealth error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getSyncState = async (req, res) => {
  try {
    const state = await HealthSyncState.findOne({ user: req.user._id });
    res.status(200).json({
      changesToken: state?.changesToken || null,
      lastSyncedAt: state?.lastSyncedAt || null,
    });
  } catch (error) {
    console.error("getSyncState error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.syncBatch = async (req, res) => {
  try {
    const connection = await HealthConnection.findOne({ user: req.user._id, connected: true });
    if (!connection) {
      return res.status(400).json({ message: "Health data is not connected" });
    }

    const { records, deletedRecordIds, changesToken } = req.body;

    if (!Array.isArray(records) || !Array.isArray(deletedRecordIds)) {
      return res.status(400).json({ message: "records and deletedRecordIds must be arrays" });
    }

    let upserted = 0;

    for (const record of records) {
      const { recordType, healthConnectRecordId, startTime, endTime, sourceOrigin, device } = record;

      if (!recordType || !healthConnectRecordId || !startTime || !endTime) {
        continue; // malformed entry — skip rather than fail the whole batch
      }

      if (recordType === HEALTH_SLEEP_RECORD_TYPE) {
        await HealthSleepSession.findOneAndUpdate(
          { user: req.user._id, healthConnectRecordId },
          {
            user: req.user._id,
            healthConnectRecordId,
            startTime,
            endTime,
            stages: record.stages || [],
            title: record.title ?? null,
            sourceOrigin: sourceOrigin ?? null,
            device: device ?? null,
          },
          { upsert: true, setDefaultsOnInsert: true }
        );
      } else {
        await HealthSample.findOneAndUpdate(
          { user: req.user._id, healthConnectRecordId },
          {
            user: req.user._id,
            recordType,
            healthConnectRecordId,
            startTime,
            endTime,
            value: record.value,
            unit: record.unit ?? null,
            sourceOrigin: sourceOrigin ?? null,
            device: device ?? null,
          },
          { upsert: true, setDefaultsOnInsert: true }
        );
      }
      upserted += 1;
    }

    let deleted = 0;
    if (deletedRecordIds.length > 0) {
      const sampleResult = await HealthSample.deleteMany({
        user: req.user._id,
        healthConnectRecordId: { $in: deletedRecordIds },
      });
      const sleepResult = await HealthSleepSession.deleteMany({
        user: req.user._id,
        healthConnectRecordId: { $in: deletedRecordIds },
      });
      deleted = sampleResult.deletedCount + sleepResult.deletedCount;
    }

    if (changesToken) {
      await HealthSyncState.findOneAndUpdate(
        { user: req.user._id },
        { user: req.user._id, changesToken, lastSyncedAt: new Date() },
        { upsert: true, setDefaultsOnInsert: true }
      );
    }

    res.status(200).json({ message: "Synced", upserted, deleted });
  } catch (error) {
    console.error("syncBatch error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.deleteHealthData = async (req, res) => {
  try {
    const sampleResult = await HealthSample.deleteMany({ user: req.user._id });
    const sleepResult = await HealthSleepSession.deleteMany({ user: req.user._id });
    await HealthSyncState.deleteOne({ user: req.user._id });

    const deletedCount = sampleResult.deletedCount + sleepResult.deletedCount;
    res.status(200).json({ message: "Health data deleted", deletedCount });
  } catch (error) {
    console.error("deleteHealthData error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
