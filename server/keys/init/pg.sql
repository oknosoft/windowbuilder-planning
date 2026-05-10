--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = off;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET escape_string_warning = off;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: key_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.key_type AS ENUM (
    'order',
    'product',
    'layer',
    'profile',
    'filling',
    'glass',
    'glunit',
    'layout',
    'mosquito',
    'set',
    'fragment',
    'box',
    'other'
);


--
-- Name: keys_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.keys_type AS (
	obj uuid,
	specimen integer,
	elm integer,
	region integer
);


--
-- Name: phases; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.phases AS ENUM (
    'plan',
    'run',
    'ready'
);


--
-- Name: prod_row; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.prod_row AS (
	characteristic uuid,
	quantity integer
);


--
-- Name: qinfo_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.qinfo_type AS (
	abonent uuid,
	year integer,
	branch uuid,
	barcode bigint,
	ref uuid,
	calc_order uuid,
	characteristic uuid,
	presentation character varying(200),
	specimen integer,
	elm integer,
	region integer,
	type public.key_type,
	leading_product uuid
);


--
-- Name: refs; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.refs AS ENUM (
    'cat.characteristics',
    'cat.planning_keys',
    'cat.users',
    'cat.partners',
    'doc.calc_order',
    'doc.planning_event',
    'doc.work_centers_task',
    'doc.work_centers_performance',
    'doc.purchase_order',
    'doc.debit_cash_order',
    'doc.credit_cash_order',
    'doc.credit_card_order',
    'doc.debit_bank_order',
    'doc.credit_bank_order',
    'doc.selling',
    'doc.purchase',
    'doc.nom_prices_setup',
    'doc.inventory_cuts',
    'doc.inventory_goods'
);


--
-- Name: qinfo(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.qinfo(code character varying) RETURNS public.qinfo_type
    LANGUAGE plpgsql
    AS $$
declare
	tmp qinfo_type;
	keys_row keys%ROWTYPE;
	cx_row characteristics%ROWTYPE;
	order_row calc_orders%ROWTYPE;
	icode bigint;
	ucode uuid;
begin
  /* ищем запись в keys */
  if(char_length(code) = 13) then
	code = substring(code, 1, 12);
  end if;
  if char_length(code) = 12 then
    icode = code;
	SELECT * INTO keys_row FROM keys WHERE barcode=icode;
  elseif char_length(code) = 36 then
    ucode = code;
    SELECT * INTO keys_row FROM keys WHERE ref=ucode;
  end if;

  /* подклеиваем заказ и прочую инфу */
  if keys_row.type is null then
	RAISE NOTICE 'null';
  elseif keys_row.type = 'order' then
	SELECT * INTO order_row FROM calc_orders WHERE ref=keys_row.obj;
  else
	SELECT * INTO cx_row FROM characteristics WHERE ref=keys_row.obj;
	SELECT * INTO order_row FROM calc_orders WHERE ref=cx_row.calc_order;
  end if;
  tmp.abonent = order_row.abonent;
  tmp.year = order_row.year;
  tmp.branch = order_row.branch;
  tmp.calc_order = order_row.ref;

  tmp.characteristic = cx_row.ref;
  tmp.leading_product = cx_row.leading_product;

  tmp.barcode = keys_row.barcode;
  tmp.ref = keys_row.ref;
  tmp.specimen = keys_row.specimen;
  tmp.elm = keys_row.elm;
  tmp.region = keys_row.region;
  tmp.type = keys_row.type;

  if keys_row.type = 'order' then
  	tmp.presentation = format('%s от %s', order_row.number_doc, order_row.date);
  else
  	tmp.presentation = cx_row.name;
  end if;
  return tmp;
end
$$;


SET default_table_access_method = heap;

--
-- Name: areg_cuttings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.areg_cuttings (
    register uuid NOT NULL,
    register_type public.refs NOT NULL,
    row_num bigint NOT NULL,
    period timestamp without time zone,
    sign smallint DEFAULT 1,
    work_center uuid,
    nom uuid,
    characteristic uuid,
    len numeric(8,2) DEFAULT 0,
    width numeric(8,2) DEFAULT 0,
    qty integer DEFAULT 0,
    quantity numeric(15,3) DEFAULT 0,
    amount numeric(15,3) DEFAULT 0
);


--
-- Name: TABLE areg_cuttings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.areg_cuttings IS 'Деловая обрезь';


--
-- Name: areg_dates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.areg_dates (
    register uuid NOT NULL,
    register_type public.refs NOT NULL,
    row_num bigint NOT NULL,
    period timestamp without time zone NOT NULL,
    sign smallint DEFAULT 1 NOT NULL,
    phase public.phases DEFAULT 'plan'::public.phases NOT NULL,
    date date,
    shift uuid,
    work_center uuid,
    planing_key bigint,
    stage uuid,
    part uuid,
    part_type public.refs,
    calc_order uuid,
    power numeric(15,3) DEFAULT 0
);

COMMENT ON COLUMN public.areg_dates.register IS 'Регистратор';
COMMENT ON COLUMN public.areg_dates.register_type IS 'Тип регистратора';
COMMENT ON COLUMN public.areg_dates.row_num IS 'Номер строки';
COMMENT ON COLUMN public.areg_dates.period IS 'Период';
COMMENT ON COLUMN public.areg_dates.sign IS 'Вид движения приход-расход';
COMMENT ON COLUMN public.areg_dates.phase IS 'Фаза планирования';
COMMENT ON COLUMN public.areg_dates.date IS 'Дата план или факт';
COMMENT ON COLUMN public.areg_dates.shift IS 'Смена';
COMMENT ON COLUMN public.areg_dates.work_center IS 'Рабочий центр';
COMMENT ON COLUMN public.areg_dates.planing_key IS 'Ключ планирования (barcode)';
COMMENT ON COLUMN public.areg_dates.stage IS 'Этап производства';
COMMENT ON COLUMN public.areg_dates.part IS 'Партия';
COMMENT ON COLUMN public.areg_dates.part IS 'Тип партии';
COMMENT ON COLUMN public.areg_dates.calc_order IS 'Расчёт';
COMMENT ON COLUMN public.areg_dates.power IS 'Мощность';


--
-- Name: areg_needs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.areg_needs (
    register uuid NOT NULL,
    register_type public.refs NOT NULL,
    row_num bigint NOT NULL,
    period timestamp without time zone,
    sign smallint DEFAULT 1,
    calc_order uuid,
    nom uuid,
    characteristic uuid,
    stage uuid,
    planing_key uuid,
    quantity numeric(15,3) DEFAULT 0
);

COMMENT ON COLUMN public.areg_needs.register IS 'Регистратор';
COMMENT ON COLUMN public.areg_needs.register_type IS 'Тип регистратора';
COMMENT ON COLUMN public.areg_needs.row_num IS 'Номер строки';
COMMENT ON COLUMN public.areg_needs.period IS 'Период';
COMMENT ON COLUMN public.areg_needs.nom IS 'Номенклатура';
COMMENT ON COLUMN public.areg_needs.characteristic IS 'Характеристика';
COMMENT ON COLUMN public.areg_needs.stage IS 'Этап производства';
COMMENT ON COLUMN public.areg_needs.planing_key IS 'Ключ планирования';
COMMENT ON COLUMN public.areg_needs.quantity IS 'Количество';


--
-- Name: calc_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calc_orders (
    ref uuid NOT NULL,
    abonent uuid,
    branch uuid,
    year integer,
    date timestamp without time zone,
    number_doc character(11),
    partner uuid,
    organization uuid,
    author uuid,
    department uuid,
    production json
);


--
-- Name: characteristics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.characteristics (
    ref uuid NOT NULL,
    calc_order uuid,
    leading_product uuid,
    name character varying(200)
);


--
-- Name: feed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed (
    seq uuid NOT NULL,
    abonent uuid,
    branch uuid,
    year integer,
    type public.refs,
    ref uuid,
    rev character varying(64),
    deleted boolean
);


--
-- Name: keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.keys (
    ref uuid DEFAULT public.uuid_generate_v1mc() NOT NULL,
    obj uuid NOT NULL,
    specimen integer DEFAULT 1,
    elm integer DEFAULT 0,
    region integer DEFAULT 0,
    barcode bigint DEFAULT 0,
    type public.key_type
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    param character varying(100) NOT NULL,
    value json NOT NULL
);


--
-- Name: address; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX address ON public.keys USING btree (obj, specimen, elm, region);


--
-- Name: areg_cuttings areg_cuttings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areg_cuttings
    ADD CONSTRAINT areg_cuttings_pkey PRIMARY KEY (register, register_type, row_num);


--
-- Name: areg_dates areg_dates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areg_dates
    ADD CONSTRAINT areg_dates_pkey PRIMARY KEY (register, register_type, row_num);


--
-- Name: areg_needs areg_needs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areg_needs
    ADD CONSTRAINT areg_needs_pkey PRIMARY KEY (register, register_type, row_num);


--
-- Name: phase_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX phase_date ON public.areg_dates USING btree (phase, date) WITH (deduplicate_items='true');


--
-- Name: phase_part; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX phase_part ON public.areg_dates USING btree (phase, part) WITH (deduplicate_items='true');


--
-- Name: characteristics characteristics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characteristics
    ADD CONSTRAINT characteristics_pkey PRIMARY KEY (ref);


--
-- Name: feed feed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed
    ADD CONSTRAINT feed_pkey PRIMARY KEY (seq);


--
-- Name: keys keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.keys
    ADD CONSTRAINT keys_pkey PRIMARY KEY (ref);


--
-- Name: calc_orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calc_orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (ref);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (param);


--
-- Name: barcode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX barcode ON public.keys USING btree (barcode);


--
-- Name: barcode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX barcode_key ON public.areg_dates USING btree (planing_key) WITH (deduplicate_items='true');


--
-- Name: characteristics order; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characteristics
    ADD CONSTRAINT "order" FOREIGN KEY (calc_order) REFERENCES public.calc_orders(ref) NOT VALID;


--
-- PostgreSQL database dump complete
--

