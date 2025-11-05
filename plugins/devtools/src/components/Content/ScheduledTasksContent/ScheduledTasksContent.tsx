/*
 * Copyright 2025 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import React, { useState } from 'react';
import Box from '@material-ui/core/Box';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import Typography from '@material-ui/core/Typography';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import { makeStyles, createStyles, Theme } from '@material-ui/core/styles';
import { Progress, Table, TableColumn } from '@backstage/core-components';
import Alert from '@material-ui/lab/Alert';
import { useScheduledTasks, useTriggerScheduledTask } from '../../../hooks';
import { TaskApiTasksResponse } from '@backstage/plugin-devtools-common';
import { alertApiRef, configApiRef, useApi } from '@backstage/core-plugin-api';
import RefreshIcon from '@material-ui/icons/Refresh';
import NightsStay from '@material-ui/icons/NightsStay';
import Error from '@material-ui/icons/Error';
import CircularProgress from '@material-ui/core/CircularProgress';
import { ScheduledTaskDetailPanel } from './ScheduledTaskDetailedPanel';
import { RequirePermission } from '@backstage/plugin-permission-react';
import { devToolsTaskSchedulerCreatePermission } from '@backstage/plugin-devtools-common';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    paperStyle: {
      display: 'flex',
      marginBottom: theme.spacing(2),
    },
    flexContainer: {
      display: 'flex',
      flexDirection: 'row',
      padding: 0,
    },
    formControl: {
      minWidth: 240,
      marginBottom: theme.spacing(2),
    },
    detailPanel: {
      padding: theme.spacing(2),
      backgroundColor: theme.palette.background.default,
    },
    detailLabel: {
      fontWeight: 'bold',
      marginRight: theme.spacing(1),
    },
    errorIcon: {
      color: theme.palette.error.main,
      marginRight: theme.spacing(1),
      fontSize: '1.2rem',
    },
    detailPanelAlert: {
      marginBottom: theme.spacing(2),
    },
  }),
);

const StatusDisplay = ({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) => (
  <Box display="flex" alignItems="center">
    {icon}
    <Typography variant="body2" style={{ marginLeft: 8 }}>
      {text}
    </Typography>
  </Box>
);

/** @public */
export const ScheduledTasksContent = () => {
  const classes = useStyles();
  const configApi = useApi(configApiRef);
  const alertApi = useApi(alertApiRef);
  const plugins = configApi.getStringArray('devTools.scheduledTasks.plugins');
  const [selectedPlugin, setSelectedPlugin] = useState(plugins[0] || '');
  const { scheduledTasks, loading, error } = useScheduledTasks(selectedPlugin);
  const { triggerTask, isTriggering, triggerError } = useTriggerScheduledTask();

  if (!plugins || plugins.length === 0) {
    return (
      <Alert severity="info">
        No plugins configured for scheduled tasks. Please configure
        `devTools.scheduledTasks.plugins` in app-config.yaml.
      </Alert>
    );
  }

  const handlePluginChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setSelectedPlugin(event.target.value as string);
  };

  const columns: TableColumn<TaskApiTasksResponse>[] = [
    {
      title: 'Task ID',
      field: 'taskId',
      width: '35%',
      render: (rowData: TaskApiTasksResponse) => {
        const errorIconStyle: React.CSSProperties = {
          color: '#f44336',
          marginRight: '8px',
          fontSize: '1.2rem',
          verticalAlign: 'middle',
        };

        return (
          <Box display="flex" alignItems="center">
            {rowData.taskState?.lastRunError && (
              <Error style={errorIconStyle} />
            )}
            <Typography>{rowData.taskId}</Typography>
          </Box>
        );
      },
    },
    {
      title: 'Status',
      field: 'taskState.status',
      width: '15%',
      render: (rowData: TaskApiTasksResponse) => {
        const status = rowData.taskState?.status;

        if (status === 'idle') {
          return (
            <StatusDisplay icon={<NightsStay fontSize="small" />} text="Idle" />
          );
        }

        if (status === 'running') {
          return (
            <StatusDisplay
              icon={<CircularProgress color="inherit" size="30px" />}
              text="Running"
            />
          );
        }

        return <Typography variant="body2">{status || 'N/A'}</Typography>;
      },
    },
    {
      title: 'Last Run',
      field: 'taskState.lastRunEndedAt',
      width: '25%',
      render: (rowData: TaskApiTasksResponse) =>
        rowData.taskState?.lastRunEndedAt
          ? new Date(rowData.taskState.lastRunEndedAt).toLocaleString()
          : 'N/A',
    },
    {
      title: 'Next Run',
      width: '15%',
      render: (rowData: TaskApiTasksResponse) =>
        rowData.taskState?.status === 'idle' && rowData.taskState.startsAt
          ? new Date(rowData.taskState.startsAt).toLocaleString()
          : 'N/A',
    },
    {
      title: 'Actions',
      render: (rowData: TaskApiTasksResponse) => (
        <RequirePermission permission={devToolsTaskSchedulerCreatePermission}>
          <Tooltip title="Refresh">
            <IconButton
              aria-label="Trigger"
              onClick={() => {
                triggerTask(selectedPlugin, rowData.taskId);
                if (isTriggering) {
                  <CircularProgress color="inherit" size="30px" />;
                }
                if (triggerError) {
                  alertApi.post({
                    message: `Error triggering task ${rowData.taskId}: ${error}`,
                    severity: 'error',
                  });
                } else {
                  alertApi.post({
                    message: `Successfully triggered task ${rowData.taskId}`,
                    severity: 'success',
                  });
                }
              }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </RequirePermission>
      ),
      sorting: false,
      width: '10%',
    },
  ];

  return (
    <Box>
      <FormControl variant="outlined" className={classes.formControl}>
        <InputLabel id="plugin-select-label">Select Plugin</InputLabel>
        <Select
          labelId="plugin-select-label"
          id="plugin-select"
          value={selectedPlugin}
          onChange={handlePluginChange}
          label="Select Plugin"
        >
          {plugins.map(plugin => (
            <MenuItem key={plugin} value={plugin}>
              {plugin}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {loading && <Progress />}

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && (
        <Table
          title={`Scheduled Tasks (${selectedPlugin})`}
          options={{
            paging: true,
            search: true,
            sorting: true,
            searchFieldAlignment: 'right',
          }}
          columns={columns}
          data={scheduledTasks || []}
          emptyContent={
            <Alert severity="info">
              No scheduled tasks found for {selectedPlugin}.
            </Alert>
          }
          detailPanel={({ rowData }) => {
            return <ScheduledTaskDetailPanel rowData={rowData} />;
          }}
        />
      )}
    </Box>
  );
};
