--
-- PostgreSQL database dump
--

-- Dumped from database version 14.8
-- Dumped by pg_dump version 14.8

-- Started on 2023-07-31 22:40:11 MSK

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = off;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET escape_string_warning = off;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 2899788)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 3387 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner:
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- TOC entry 863 (class 1247 OID 3176553)
-- Name: key_type; Type: TYPE; Schema: public; Owner: postgres
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
    'other'
);


ALTER TYPE public.key_type OWNER TO postgres;

--
-- TOC entry 869 (class 1247 OID 3698031)
-- Name: prod_row; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.prod_row AS (
	characteristic uuid,
	quantity integer
);


ALTER TYPE public.prod_row OWNER TO postgres;

--
-- TOC entry 866 (class 1247 OID 3556323)
-- Name: qinfo_type; Type: TYPE; Schema: public; Owner: postgres
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


ALTER TYPE public.qinfo_type OWNER TO postgres;

--
-- TOC entry 872 (class 1247 OID 5825217)
-- Name: refs; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.refs AS ENUM (
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
    'doc.nom_prices_setup'
);


ALTER TYPE public.refs OWNER TO postgres;

--
-- TOC entry 240 (class 1255 OID 3558639)
-- Name: qinfo(character varying); Type: FUNCTION; Schema: public; Owner: postgres
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


ALTER FUNCTION public.qinfo(code character varying) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 218 (class 1259 OID 6006161)
-- Name: areg_needs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.areg_needs (
    register uuid NOT NULL,
    register_type public.refs NOT NULL,
    row_num bigint NOT NULL,
    period timestamp without time zone,
    nom uuid,
    characteristic uuid,
    stage uuid,
    planing_key uuid,
    quantity numeric(15,3) DEFAULT 0
);


ALTER TABLE public.areg_needs OWNER TO postgres;

--
-- TOC entry 3388 (class 0 OID 0)
-- Dependencies: 218
-- Name: COLUMN areg_needs.register; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.areg_needs.register IS 'Регистратор';


--
-- TOC entry 3389 (class 0 OID 0)
-- Dependencies: 218
-- Name: COLUMN areg_needs.register_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.areg_needs.register_type IS 'Тип регистратора';


--
-- TOC entry 3390 (class 0 OID 0)
-- Dependencies: 218
-- Name: COLUMN areg_needs.row_num; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.areg_needs.row_num IS 'Номер строки';


--
-- TOC entry 3391 (class 0 OID 0)
-- Dependencies: 218
-- Name: COLUMN areg_needs.period; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.areg_needs.period IS 'Период';


--
-- TOC entry 3392 (class 0 OID 0)
-- Dependencies: 218
-- Name: COLUMN areg_needs.nom; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.areg_needs.nom IS 'Номенклатура';


--
-- TOC entry 3393 (class 0 OID 0)
-- Dependencies: 218
-- Name: COLUMN areg_needs.characteristic; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.areg_needs.characteristic IS 'Характеристика';


--
-- TOC entry 3394 (class 0 OID 0)
-- Dependencies: 218
-- Name: COLUMN areg_needs.stage; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.areg_needs.stage IS 'Этап производства';


--
-- TOC entry 3395 (class 0 OID 0)
-- Dependencies: 218
-- Name: COLUMN areg_needs.planing_key; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.areg_needs.planing_key IS 'Ключ планирования';


--
-- TOC entry 3396 (class 0 OID 0)
-- Dependencies: 218
-- Name: COLUMN areg_needs.quantity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.areg_needs.quantity IS 'Количество';


--
-- TOC entry 215 (class 1259 OID 3061481)
-- Name: calc_orders; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.calc_orders OWNER TO postgres;

--
-- TOC entry 213 (class 1259 OID 2900139)
-- Name: characteristics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.characteristics (
    ref uuid NOT NULL,
    calc_order uuid,
    leading_product uuid,
    name character varying(200)
);


ALTER TABLE public.characteristics OWNER TO postgres;

--
-- TOC entry 212 (class 1259 OID 2899806)
-- Name: keys; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.keys OWNER TO postgres;

--
-- TOC entry 214 (class 1259 OID 2900714)
-- Name: settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.settings (
    param character varying(100) NOT NULL,
    value json NOT NULL
);


ALTER TABLE public.settings OWNER TO postgres;

--
-- TOC entry 3230 (class 1259 OID 3061357)
-- Name: address; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX address ON public.keys USING btree (obj, specimen, elm, region);


--
-- TOC entry 3241 (class 2606 OID 6006168)
-- Name: areg_needs calculations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.areg_needs
    ADD CONSTRAINT calculations_pkey PRIMARY KEY (register, register_type, row_num);


--
-- TOC entry 3235 (class 2606 OID 2900143)
-- Name: characteristics characteristics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.characteristics
    ADD CONSTRAINT characteristics_pkey PRIMARY KEY (ref);


--
-- TOC entry 3233 (class 2606 OID 2899811)
-- Name: keys keys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.keys
    ADD CONSTRAINT keys_pkey PRIMARY KEY (ref);


--
-- TOC entry 3239 (class 2606 OID 3061485)
-- Name: calc_orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calc_orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (ref);


--
-- TOC entry 3237 (class 2606 OID 2900720)
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (param);


--
-- TOC entry 3231 (class 1259 OID 3494689)
-- Name: barcode; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX barcode ON public.keys USING btree (barcode);


--
-- TOC entry 3242 (class 2606 OID 3061494)
-- Name: characteristics order; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.characteristics
    ADD CONSTRAINT "order" FOREIGN KEY (calc_order) REFERENCES public.calc_orders(ref) NOT VALID;


-- Completed on 2023-07-31 22:40:11 MSK

--
-- PostgreSQL database dump complete
--

